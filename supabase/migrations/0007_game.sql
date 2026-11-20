-- busspotburgas · Етап 5: точки, рангове, значки, класации, снимка и спотър на месеца, видео връзки.
-- Безопасно е да се пусне повече от веднъж.

-- ═════════════════════════════════════════════════════════════
-- ВИДЕО ВРЪЗКИ (TikTok/YouTube, след одобрение)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.videos (
  id          bigint generated always as identity primary key,
  vehicle_id  bigint not null references public.vehicles(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  url         text not null check (url ~ '^https://(www\.|m\.|vm\.)?(youtube\.com|youtu\.be|tiktok\.com)/' and char_length(url) <= 300),
  provider    text not null check (provider in ('youtube', 'tiktok')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (vehicle_id, url)
);
create or replace function public.videos_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare admin boolean := public.is_admin();
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then raise exception 'email_not_confirmed'; end if;
    new.user_id := auth.uid();
    new.status := case when admin then 'approved' else 'pending' end;
    new.reviewed_at := case when admin then now() end;
    return new;
  end if;
  if not admin then raise exception 'not_allowed'; end if;
  return new;
end; $$;
drop trigger if exists videos_guard on public.videos;
create trigger videos_guard before insert or update on public.videos for each row execute function public.videos_guard();

alter table public.videos enable row level security;
drop policy if exists "videos_read" on public.videos;
drop policy if exists "videos_ins" on public.videos;
drop policy if exists "videos_upd" on public.videos;
drop policy if exists "videos_del" on public.videos;
create policy "videos_read" on public.videos for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "videos_ins" on public.videos for insert to authenticated with check (true);
create policy "videos_upd" on public.videos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "videos_del" on public.videos for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.videos to anon, authenticated;
grant insert, delete on public.videos to authenticated;
grant update (status, reviewed_at) on public.videos to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ТОЧКИ (дневник: всяка точка с причина; без повторения)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.points_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  ref         text not null,
  amount      int not null,
  created_at  timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at);
create index if not exists points_ledger_ref_idx on public.points_ledger (ref);
alter table public.points_ledger enable row level security;
drop policy if exists "points_read" on public.points_ledger;
create policy "points_read" on public.points_ledger for select to anon, authenticated using (true);
grant select on public.points_ledger to anon, authenticated;

-- Рангове: Новак 0 → Спотър 50 → Ветеран 250 → Експерт 750 → Легенда 2000
create or replace function public.rank_of(p_points int)
returns text language sql immutable as $$
  select case when p_points >= 2000 then 'legend' when p_points >= 750 then 'expert'
              when p_points >= 250 then 'veteran' when p_points >= 50 then 'spotter' else 'rookie' end;
$$;

create or replace view public.user_points
with (security_invoker = true) as
select p.id as user_id,
       coalesce(sum(l.amount), 0)::int as total,
       coalesce(sum(l.amount) filter (where l.created_at >= date_trunc('month', now() at time zone 'Europe/Sofia') at time zone 'Europe/Sofia'), 0)::int as month_total,
       public.rank_of(coalesce(sum(l.amount), 0)::int) as rank
from public.profiles p
left join public.points_ledger l on l.user_id = p.id
group by p.id;
grant select on public.user_points to anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- ЗНАЧКИ (вид „билет“)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.user_badges (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badge       text not null,   -- photos | model | night | rain | photo_of_month | spotter_of_month
  ref         text not null,   -- 10/50/100/500 | id на модел | 1 | ГГГГ-ММ
  created_at  timestamptz not null default now(),
  primary key (user_id, badge, ref)
);
alter table public.user_badges enable row level security;
drop policy if exists "badges_read" on public.user_badges;
create policy "badges_read" on public.user_badges for select to anon, authenticated using (true);
grant select on public.user_badges to anon, authenticated;

create or replace function public.give_badge(p_user uuid, p_badge text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_badges (user_id, badge, ref) values (p_user, p_badge, p_ref) on conflict do nothing;
  if found then perform public.notify(p_user, 'badge', jsonb_build_object('badge', p_badge, 'ref', p_ref)); end if;
end; $$;

-- Преизчислява значките, които зависят от снимките на спотъра
create or replace function public.refresh_badges(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n int;
  t int;
  m record;
begin
  if p_user is null then return; end if;
  select count(*) into n from public.photos where user_id = p_user and status = 'approved';
  foreach t in array array[10, 50, 100, 500] loop
    if n >= t then perform public.give_badge(p_user, 'photos', t::text); end if;
  end loop;
  if exists (select 1 from public.photos where user_id = p_user and status = 'approved' and is_night) then perform public.give_badge(p_user, 'night', '1'); end if;
  if exists (select 1 from public.photos where user_id = p_user and status = 'approved' and is_rain) then perform public.give_badge(p_user, 'rain', '1'); end if;
  -- Целият модел: снимал е всяка активна кола от модела
  for m in
    select v.model_id,
           count(*) as total,
           count(*) filter (where exists (select 1 from public.photos p where p.vehicle_id = v.id and p.user_id = p_user and p.status = 'approved')) as mine
    from public.vehicles v where not v.is_historic and v.status <> 'scrapped' group by v.model_id
  loop
    if m.total > 0 and m.mine = m.total then perform public.give_badge(p_user, 'model', m.model_id); end if;
  end loop;
end; $$;

-- Даване на точки (+ известие при нов ранг + значки)
create or replace function public.award(p_user uuid, p_reason text, p_ref text, p_amount int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_before int;
  v_after int;
begin
  if p_user is null then return; end if;
  select coalesce(sum(amount), 0) into v_before from public.points_ledger where user_id = p_user;
  insert into public.points_ledger (user_id, reason, ref, amount) values (p_user, p_reason, p_ref, p_amount)
    on conflict (user_id, reason, ref) do nothing;
  if not found then return; end if;
  v_after := v_before + p_amount;
  if public.rank_of(v_after) <> public.rank_of(v_before) and v_after > v_before then
    perform public.notify(p_user, 'rank', jsonb_build_object('rank', public.rank_of(v_after)));
  end if;
end; $$;

create or replace function public.unaward(p_ref text, p_reasons text[])
returns void language sql security definer set search_path = '' as $$
  delete from public.points_ledger where ref = p_ref and reason = any(p_reasons);
$$;

revoke all on function public.give_badge(uuid, text, text), public.refresh_badges(uuid), public.award(uuid, text, text, int), public.unaward(text, text[])
  from public, anon, authenticated;

-- ── Точки за снимки ─────────────────────────────────────────────────────
-- +10 одобрена · +20 първа снимка на колата в сайта · +15 спряна или нова кола
create or replace function public.photos_points()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' then
    perform public.unaward(old.id::text, array['photo', 'first_photo', 'rare_vehicle']);
    perform public.refresh_badges(old.user_id);
    return old;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') and new.user_id is not null then
    perform public.award(new.user_id, 'photo', new.id::text, 10);
    if not exists (select 1 from public.photos where vehicle_id = new.vehicle_id and status = 'approved' and id <> new.id) then
      perform public.award(new.user_id, 'first_photo', new.id::text, 20);
    end if;
    select status::text into v_status from public.vehicles where id = new.vehicle_id;
    if v_status in ('stop', 'new') then perform public.award(new.user_id, 'rare_vehicle', new.id::text, 15); end if;
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'approved' then
    perform public.unaward(new.id::text, array['photo', 'first_photo', 'rare_vehicle']);
  end if;
  perform public.refresh_badges(new.user_id);
  return new;
end; $$;
drop trigger if exists photos_points on public.photos;
create trigger photos_points after insert or update of status, is_night, is_rain or delete on public.photos
  for each row execute function public.photos_points();

-- +2 за оценка (веднъж на кола)
create or replace function public.ratings_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.award(new.user_id, 'rating', new.vehicle_id::text, 2);
  return new;
end; $$;
drop trigger if exists ratings_points on public.vehicle_ratings;
create trigger ratings_points after insert on public.vehicle_ratings for each row execute function public.ratings_points();

-- +1 за одобрен коментар
create or replace function public.comments_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.unaward(old.id::text, array['comment']);
    return old;
  end if;
  if new.status = 'approved' then perform public.award(new.user_id, 'comment', new.id::text, 1);
  else perform public.unaward(new.id::text, array['comment']); end if;
  return new;
end; $$;
drop trigger if exists comments_points on public.photo_comments;
create trigger comments_points after insert or update of status or delete on public.photo_comments
  for each row execute function public.comments_points();

-- +5 за одобрена видео връзка
create or replace function public.videos_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.unaward(old.id::text, array['video']);
    return old;
  end if;
  if new.status = 'approved' then perform public.award(new.user_id, 'video', new.id::text, 5);
  else perform public.unaward(new.id::text, array['video']); end if;
  return new;
end; $$;
drop trigger if exists videos_points on public.videos;
create trigger videos_points after insert or update of status or delete on public.videos
  for each row execute function public.videos_points();

-- Точки за вече одобрените неща отпреди Етап 5
do $$ declare p record; begin
  for p in select id, user_id, vehicle_id, created_at from public.photos where status = 'approved' and user_id is not null order by created_at loop
    perform public.award(p.user_id, 'photo', p.id::text, 10);
    if not exists (select 1 from public.photos o where o.vehicle_id = p.vehicle_id and o.status = 'approved' and o.created_at < p.created_at) then
      perform public.award(p.user_id, 'first_photo', p.id::text, 20);
    end if;
  end loop;
  for p in select user_id, vehicle_id from public.vehicle_ratings loop perform public.award(p.user_id, 'rating', p.vehicle_id::text, 2); end loop;
  for p in select id, user_id from public.photo_comments where status = 'approved' and user_id is not null loop perform public.award(p.user_id, 'comment', p.id::text, 1); end loop;
  for p in select distinct user_id from public.photos where user_id is not null loop perform public.refresh_badges(p.user_id); end loop;
end $$;

-- ═════════════════════════════════════════════════════════════
-- КЛАСАЦИИ: month | all | model | collection
-- ═════════════════════════════════════════════════════════════
create or replace function public.leaderboard(p_kind text, p_model text default null, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, role text, score int)
language sql stable security definer set search_path = '' as $$
  with s as (
    select l.user_id, sum(l.amount)::int as score from public.points_ledger l
      where p_kind = 'month' and l.created_at >= date_trunc('month', now() at time zone 'Europe/Sofia') at time zone 'Europe/Sofia'
      group by l.user_id
    union all
    select l.user_id, sum(l.amount)::int from public.points_ledger l where p_kind = 'all' group by l.user_id
    union all
    select p.user_id, count(*)::int from public.photos p join public.vehicles v on v.id = p.vehicle_id
      where p_kind = 'model' and p.status = 'approved' and v.model_id = p_model and p.user_id is not null group by p.user_id
    union all
    select p.user_id, count(distinct p.vehicle_id)::int from public.photos p
      where p_kind = 'collection' and p.status = 'approved' and p.user_id is not null group by p.user_id
  )
  select s.user_id, pr.display_name, pr.avatar_url, pr.role::text, s.score
  from s join public.profiles pr on pr.id = s.user_id
  where s.score > 0 and pr.display_name is not null
  order by s.score desc, pr.display_name
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.leaderboard(text, text, int) to anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- СНИМКА И СПОТЪР НА МЕСЕЦА
-- ═════════════════════════════════════════════════════════════
create table if not exists public.monthly_awards (
  month        date primary key,            -- първият ден на месеца
  photo_id     uuid references public.photos(id) on delete set null,
  photo_author uuid references public.profiles(id) on delete set null,
  spotter_id   uuid references public.profiles(id) on delete set null,
  decided_at   timestamptz not null default now()
);
create table if not exists public.potm_votes (
  month     date not null,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  photo_id  uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (month, user_id)
);
alter table public.monthly_awards enable row level security;
alter table public.potm_votes enable row level security;
drop policy if exists "awards_read" on public.monthly_awards;
create policy "awards_read" on public.monthly_awards for select to anon, authenticated using (true);
drop policy if exists "potm_own" on public.potm_votes;
create policy "potm_own" on public.potm_votes for select to authenticated using (user_id = (select auth.uid()));
grant select on public.monthly_awards to anon, authenticated;
grant select on public.potm_votes to authenticated;

-- Текущият месец (по българско време) и дали е в последните 3 дни
create or replace function public.potm_window()
returns table (month date, voting boolean, ends date)
language sql stable as $$
  select date_trunc('month', now() at time zone 'Europe/Sofia')::date,
         (now() at time zone 'Europe/Sofia')::date >= (date_trunc('month', now() at time zone 'Europe/Sofia') + interval '1 month' - interval '3 days')::date,
         (date_trunc('month', now() at time zone 'Europe/Sofia') + interval '1 month' - interval '1 day')::date;
$$;
grant execute on function public.potm_window() to anon, authenticated;

-- Топ 5 по харесвания от снимките, одобрени през месеца
create or replace function public.potm_candidates(p_month date)
returns table (photo_id uuid, user_id uuid, author_name text, fleet_number text, likes int, votes int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, p.author_name, v.fleet_number,
         (select count(*) from public.photo_likes l where l.photo_id = p.id)::int as likes,
         (select count(*) from public.potm_votes x where x.photo_id = p.id and x.month = p_month)::int as votes
  from public.photos p join public.vehicles v on v.id = p.vehicle_id
  where p.status = 'approved' and p.user_id is not null
    and coalesce(p.reviewed_at, p.created_at) >= p_month::timestamp at time zone 'Europe/Sofia'
    and coalesce(p.reviewed_at, p.created_at) < (p_month + interval '1 month')::timestamp at time zone 'Europe/Sofia'
  order by likes desc, p.created_at
  limit 5;
$$;
grant execute on function public.potm_candidates(date) to anon, authenticated;

-- Глас: само в последните 3 дни, за една от петте, не за своя
create or replace function public.vote_potm(p_photo uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  w record;
  author uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into w from public.potm_window();
  if not w.voting then return 'closed'; end if;
  select c.user_id into author from public.potm_candidates(w.month) c where c.photo_id = p_photo;
  if not found then return 'not_candidate'; end if;
  if author = auth.uid() then return 'own'; end if;
  insert into public.potm_votes (month, user_id, photo_id) values (w.month, auth.uid(), p_photo)
    on conflict (month, user_id) do update set photo_id = excluded.photo_id, created_at = now();
  return 'ok';
end; $$;
revoke all on function public.vote_potm(uuid) from public, anon;
grant execute on function public.vote_potm(uuid) to authenticated;

-- Решаване на месеца (нощната задача на 1-во число; може и админът)
create or replace function public.decide_month(p_month date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  win record;
  top uuid;
  label text := to_char(p_month, 'YYYY-MM');
begin
  if not (public.is_admin() or coalesce((select auth.role()), '') = 'service_role') then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.monthly_awards where month = p_month) then return 'already'; end if;
  -- Снимка: най-много гласове → най-много харесвания → най-ранна. 0 снимки = остава миналомесечната.
  select * into win from public.potm_candidates(p_month) order by votes desc, likes desc limit 1;
  -- Спотър: първият в месечната класация
  select l.user_id into top from public.points_ledger l
    where l.created_at >= p_month::timestamp at time zone 'Europe/Sofia'
      and l.created_at < (p_month + interval '1 month')::timestamp at time zone 'Europe/Sofia'
      and l.reason <> 'photo_of_month'
    group by l.user_id order by sum(l.amount) desc limit 1;
  insert into public.monthly_awards (month, photo_id, photo_author, spotter_id)
    values (p_month, win.photo_id, win.user_id, top);
  if win.photo_id is not null then
    perform public.award(win.user_id, 'photo_of_month', label, 50);
    perform public.give_badge(win.user_id, 'photo_of_month', label);
  end if;
  if top is not null then perform public.give_badge(top, 'spotter_of_month', label); end if;
  return 'ok';
end; $$;
revoke all on function public.decide_month(date) from public, anon;
grant execute on function public.decide_month(date) to authenticated, service_role;
