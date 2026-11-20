-- busspotburgas · Етап 4: ортаци, гласуване, оценки, харесвания, коментари,
-- описания, следване, известия, push. Безопасно е да се пусне повече от веднъж.

-- ═════════════════════════════════════════════════════════════
-- ИЗВЕСТИЯ (камбанката) + PUSH абонаменти
-- ═════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notif_own_read"   on public.notifications;
drop policy if exists "notif_own_update" on public.notifications;
drop policy if exists "notif_own_delete" on public.notifications;
create policy "notif_own_read"   on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notif_own_update" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notif_own_delete" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Вътрешна помощна функция (само от други функции в базата)
create or replace function public.notify(p_user uuid, p_type text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, data) select p_user, p_type, coalesce(p_data, '{}'::jsonb)
  where p_user is not null;
$$;
revoke all on function public.notify(uuid, text, jsonb) from public, anon, authenticated;

create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.push_subscriptions to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ПОКАНИ ЗА ОРТАК
-- ═════════════════════════════════════════════════════════════
do $$ begin
  create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.holder_invites (
  id           bigint generated always as identity primary key,
  vehicle_id   bigint not null references public.vehicles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id     uuid references public.profiles(id) on delete set null,
  status       public.invite_status not null default 'pending',
  message      text check (char_length(message) <= 300),
  created_at   timestamptz not null default now(),
  reminded_at  timestamptz,
  answered_at  timestamptz
);
create unique index if not exists holder_invites_one_pending
  on public.holder_invites (vehicle_id, requester_id) where status = 'pending';
create index if not exists holder_invites_owner_idx on public.holder_invites (owner_id, status);

alter table public.holder_invites enable row level security;
drop policy if exists "invites_read" on public.holder_invites;
create policy "invites_read" on public.holder_invites for select to authenticated
  using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.holder_invites to authenticated;
-- Запис само през функциите по-долу

-- Поискай да станеш ортак. Връща: id на поканата | 'free' | 'already' | 'pending' | 'inactive'
create or replace function public.request_partner(p_fleet_number text, p_message text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v record;
  owner uuid;
  new_id bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = uid and age_confirmed) then raise exception 'consent_required'; end if;
  select id, status, is_historic into v from public.vehicles where fleet_number = p_fleet_number;
  if not found or v.is_historic or v.status not in ('run', 'new', 'stop') then return 'inactive'; end if;
  if exists (select 1 from public.vehicle_holders where vehicle_id = v.id and user_id = uid) then return 'already'; end if;
  select user_id into owner from public.vehicle_holders where vehicle_id = v.id and role = 'owner';
  if owner is null then return 'free'; end if;
  if exists (select 1 from public.holder_invites where vehicle_id = v.id and requester_id = uid and status = 'pending') then return 'pending'; end if;
  insert into public.holder_invites (vehicle_id, requester_id, owner_id, message)
  values (v.id, uid, owner, nullif(left(trim(coalesce(p_message, '')), 300), ''))
  returning id into new_id;
  perform public.notify(owner, 'invite_received', jsonb_build_object('invite', new_id, 'fleet', p_fleet_number,
    'from', (select display_name from public.profiles where id = uid)));
  return new_id::text;
end;
$$;

-- Собственикът отговаря. Връща 'ok' | 'not_found'
create or replace function public.answer_invite(p_invite bigint, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  i record;
  fleet text;
begin
  select * into i from public.holder_invites where id = p_invite and status = 'pending';
  if not found then return 'not_found'; end if;
  -- Решава само текущият собственик на колата
  if not exists (select 1 from public.vehicle_holders where vehicle_id = i.vehicle_id and user_id = uid and role = 'owner') then
    return 'not_found';
  end if;
  update public.holder_invites
    set status = case when p_accept then 'accepted'::public.invite_status else 'declined' end, answered_at = now()
    where id = p_invite;
  if p_accept then
    insert into public.vehicle_holders (vehicle_id, user_id, role) values (i.vehicle_id, i.requester_id, 'partner')
    on conflict (vehicle_id, user_id) do nothing;
    delete from public.model_no_holder m using public.vehicles v
      where v.id = i.vehicle_id and m.model_id = v.model_id and m.user_id = i.requester_id;
  end if;
  select fleet_number into fleet from public.vehicles where id = i.vehicle_id;
  perform public.notify(i.requester_id, 'invite_answered',
    jsonb_build_object('invite', p_invite, 'fleet', fleet, 'accepted', p_accept));
  return 'ok';
end;
$$;

-- Заявителят се отказва от чакаща покана
create or replace function public.cancel_invite(p_invite bigint)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.holder_invites set status = 'cancelled', answered_at = now()
  where id = p_invite and requester_id = auth.uid() and status = 'pending'
  returning 'ok';
$$;

-- ═════════════════════════════════════════════════════════════
-- ГЛАСУВАНЕ ЗА НОВ СОБСТВЕНИК
-- ═════════════════════════════════════════════════════════════
create table if not exists public.owner_elections (
  id          bigint generated always as identity primary key,
  vehicle_id  bigint not null references public.vehicles(id) on delete cascade,
  status      text not null default 'open' check (status in ('open', 'admin', 'decided')),
  created_at  timestamptz not null default now(),
  ends_at     timestamptz not null default now() + interval '7 days',
  decided_at  timestamptz,
  winner_id   uuid references public.profiles(id) on delete set null
);
create unique index if not exists owner_elections_one_active
  on public.owner_elections (vehicle_id) where status in ('open', 'admin');

create table if not exists public.owner_votes (
  election_id  bigint not null references public.owner_elections(id) on delete cascade,
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (election_id, voter_id)
);

alter table public.owner_elections enable row level security;
alter table public.owner_votes enable row level security;
drop policy if exists "elections_read" on public.owner_elections;
create policy "elections_read" on public.owner_elections for select to anon, authenticated using (true);
drop policy if exists "votes_read" on public.owner_votes;
create policy "votes_read" on public.owner_votes for select to authenticated
  using (voter_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.owner_elections to anon, authenticated;
grant select on public.owner_votes to authenticated;

-- Отчита гласовете: ясен победител → собственик; равенство/без гласове → админът решава
create or replace function public.resolve_election(p_election bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  top uuid;
  top_count int;
  second_count int;
  fleet text;
begin
  select * into e from public.owner_elections where id = p_election and status = 'open' for update;
  if not found then return 'not_open'; end if;
  select candidate_id, count(*) into top, top_count from public.owner_votes
    where election_id = p_election group by candidate_id order by count(*) desc limit 1;
  select count(*) into second_count from public.owner_votes
    where election_id = p_election group by candidate_id order by count(*) desc offset 1 limit 1;
  select fleet_number into fleet from public.vehicles where id = e.vehicle_id;
  if top is not null and top_count > coalesce(second_count, 0)
     and exists (select 1 from public.vehicle_holders where vehicle_id = e.vehicle_id and user_id = top) then
    update public.vehicle_holders set role = 'owner' where vehicle_id = e.vehicle_id and user_id = top;
    update public.owner_elections set status = 'decided', decided_at = now(), winner_id = top where id = p_election;
    perform public.notify(h.user_id, 'owner_elected', jsonb_build_object('fleet', fleet, 'winner',
      (select display_name from public.profiles where id = top)))
      from public.vehicle_holders h where h.vehicle_id = e.vehicle_id;
    return 'decided';
  end if;
  update public.owner_elections set status = 'admin' where id = p_election;
  return 'admin';
end;
$$;
revoke all on function public.resolve_election(bigint) from public, anon, authenticated;

-- Когато собственикът си тръгне (отказ, изтрит профил, бан)
create or replace function public.on_owner_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  partners int;
  only_partner uuid;
  fleet text;
  el bigint;
begin
  if old.role <> 'owner' then return old; end if;
  select count(*), min(user_id::text)::uuid into partners, only_partner
    from public.vehicle_holders where vehicle_id = old.vehicle_id and role = 'partner';
  if partners = 0 then return old; end if;               -- колата става свободна
  select fleet_number into fleet from public.vehicles where id = old.vehicle_id;
  if partners = 1 then                                    -- единственият ортак става собственик
    update public.vehicle_holders set role = 'owner' where vehicle_id = old.vehicle_id and user_id = only_partner;
    perform public.notify(only_partner, 'owner_elected', jsonb_build_object('fleet', fleet, 'winner',
      (select display_name from public.profiles where id = only_partner)));
    return old;
  end if;
  insert into public.owner_elections (vehicle_id) values (old.vehicle_id)
    on conflict do nothing returning id into el;
  if el is not null then
    perform public.notify(h.user_id, 'owner_vote', jsonb_build_object('fleet', fleet, 'election', el))
      from public.vehicle_holders h where h.vehicle_id = old.vehicle_id and h.role = 'partner';
  end if;
  return old;
end;
$$;
drop trigger if exists on_owner_left on public.vehicle_holders;
create trigger on_owner_left after delete on public.vehicle_holders
  for each row execute function public.on_owner_left();

-- Отказът на собственика вече е позволен и при ортаци (тръгва гласуване)
create or replace function public.release_vehicle(p_fleet_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  vid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select vh.vehicle_id into vid from public.vehicle_holders vh
    join public.vehicles v on v.id = vh.vehicle_id
    where v.fleet_number = p_fleet_number and vh.user_id = uid;
  if not found then return 'not_holder'; end if;
  delete from public.vehicle_holders where vehicle_id = vid and user_id = uid;
  return 'released';
end;
$$;

-- Глас: само ортак; кандидатът – ортак на същата кола
create or replace function public.cast_owner_vote(p_election bigint, p_candidate uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  e record;
  voters int;
  votes int;
begin
  select * into e from public.owner_elections where id = p_election and status = 'open';
  if not found then return 'closed'; end if;
  if not exists (select 1 from public.vehicle_holders where vehicle_id = e.vehicle_id and user_id = uid and role = 'partner')
     or not exists (select 1 from public.vehicle_holders where vehicle_id = e.vehicle_id and user_id = p_candidate and role = 'partner') then
    return 'not_allowed';
  end if;
  insert into public.owner_votes (election_id, voter_id, candidate_id) values (p_election, uid, p_candidate)
    on conflict (election_id, voter_id) do update set candidate_id = excluded.candidate_id, created_at = now();
  select count(*) into voters from public.vehicle_holders where vehicle_id = e.vehicle_id and role = 'partner';
  select count(*) into votes from public.owner_votes where election_id = p_election;
  if votes >= voters then return public.resolve_election(p_election); end if;
  return 'voted';
end;
$$;

-- Админът решава (равенство, без гласове, или когато самият той е ортак)
create or replace function public.admin_decide_election(p_election bigint, p_winner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  fleet text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into e from public.owner_elections where id = p_election and status in ('open', 'admin');
  if not found then return 'not_found'; end if;
  if not exists (select 1 from public.vehicle_holders where vehicle_id = e.vehicle_id and user_id = p_winner) then return 'not_holder'; end if;
  update public.vehicle_holders set role = 'owner' where vehicle_id = e.vehicle_id and user_id = p_winner;
  update public.owner_elections set status = 'decided', decided_at = now(), winner_id = p_winner where id = p_election;
  select fleet_number into fleet from public.vehicles where id = e.vehicle_id;
  perform public.notify(h.user_id, 'owner_elected', jsonb_build_object('fleet', fleet, 'winner',
    (select display_name from public.profiles where id = p_winner)))
    from public.vehicle_holders h where h.vehicle_id = e.vehicle_id;
  return 'ok';
end;
$$;

-- Махане на ортак – само админът (по молба на собственика)
create or replace function public.admin_remove_partner(p_fleet_number text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.vehicle_holders vh using public.vehicles v
    where v.id = vh.vehicle_id and v.fleet_number = p_fleet_number and vh.user_id = p_user and vh.role = 'partner';
  return 'ok';
end;
$$;

revoke all on function public.request_partner(text, text), public.answer_invite(bigint, boolean), public.cancel_invite(bigint),
  public.cast_owner_vote(bigint, uuid), public.admin_decide_election(bigint, uuid), public.admin_remove_partner(text, uuid)
  from public, anon;
grant execute on function public.request_partner(text, text), public.answer_invite(bigint, boolean), public.cancel_invite(bigint),
  public.cast_owner_vote(bigint, uuid), public.admin_decide_election(bigint, uuid), public.admin_remove_partner(text, uuid)
  to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ОПИСАНИЕ НА КОЛАТА (пише собственикът, одобрява админът)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.vehicle_descriptions (
  vehicle_id   bigint primary key references public.vehicles(id) on delete cascade,
  approved     text check (char_length(approved) <= 1000),
  approved_at  timestamptz,
  pending      text check (char_length(pending) <= 1000),
  pending_by   uuid references public.profiles(id) on delete set null,
  pending_at   timestamptz
);
alter table public.vehicle_descriptions enable row level security;
drop policy if exists "desc_read" on public.vehicle_descriptions;
create policy "desc_read" on public.vehicle_descriptions for select to anon, authenticated using (true);
-- Всички виждат само одобрения текст
revoke all on public.vehicle_descriptions from anon, authenticated;
grant select (vehicle_id, approved, approved_at) on public.vehicle_descriptions to anon, authenticated;

create or replace function public.submit_description(p_fleet_number text, p_text text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  vid bigint;
  body text := nullif(left(trim(coalesce(p_text, '')), 1000), '');
begin
  select v.id into vid from public.vehicles v join public.vehicle_holders h on h.vehicle_id = v.id
    where v.fleet_number = p_fleet_number and h.user_id = uid and h.role = 'owner';
  if vid is null then return 'not_owner'; end if;
  insert into public.vehicle_descriptions (vehicle_id, pending, pending_by, pending_at) values (vid, body, uid, now())
    on conflict (vehicle_id) do update set pending = excluded.pending, pending_by = uid, pending_at = now();
  if public.is_admin() then   -- текстът на админа излиза веднага
    update public.vehicle_descriptions set approved = pending, approved_at = now(), pending = null, pending_by = null, pending_at = null
      where vehicle_id = vid;
  end if;
  return 'ok';
end;
$$;

create or replace function public.admin_pending_descriptions()
returns table (vehicle_id bigint, fleet_number text, pending text, approved text, author text, pending_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.vehicle_id, v.fleet_number, d.pending, d.approved, p.display_name, d.pending_at
  from public.vehicle_descriptions d
  join public.vehicles v on v.id = d.vehicle_id
  left join public.profiles p on p.id = d.pending_by
  where public.is_admin() and d.pending_at is not null
  order by d.pending_at;
$$;

create or replace function public.admin_review_description(p_vehicle bigint, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.vehicle_descriptions
    set approved = case when p_approve then pending else approved end,
        approved_at = case when p_approve then now() else approved_at end,
        pending = null, pending_by = null, pending_at = null
    where vehicle_id = p_vehicle;
  return 'ok';
end;
$$;
revoke all on function public.submit_description(text, text), public.admin_pending_descriptions(), public.admin_review_description(bigint, boolean) from public, anon;
grant execute on function public.submit_description(text, text), public.admin_pending_descriptions(), public.admin_review_description(bigint, boolean) to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ОЦЕНКИ (1–5 в 4 категории, веднъж на кола, може да се промени)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.vehicle_ratings (
  vehicle_id  bigint not null references public.vehicles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  look        smallint not null check (look between 1 and 5),
  comfort     smallint not null check (comfort between 1 and 5),
  sound       smallint not null check (sound between 1 and 5),
  rarity      smallint not null check (rarity between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
alter table public.vehicle_ratings enable row level security;
drop policy if exists "ratings_read" on public.vehicle_ratings;
drop policy if exists "ratings_own"  on public.vehicle_ratings;
drop policy if exists "ratings_own_upd" on public.vehicle_ratings;
create policy "ratings_read" on public.vehicle_ratings for select to anon, authenticated using (true);
create policy "ratings_own" on public.vehicle_ratings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ratings_own_upd" on public.vehicle_ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.vehicle_ratings to anon, authenticated;
grant insert, update on public.vehicle_ratings to authenticated;

create or replace view public.vehicle_rating_stats
with (security_invoker = true) as
select vehicle_id, count(*) as votes,
       round(avg(look), 2) as look, round(avg(comfort), 2) as comfort,
       round(avg(sound), 2) as sound, round(avg(rarity), 2) as rarity,
       round(avg((look + comfort + sound + rarity) / 4.0), 2) as overall
from public.vehicle_ratings group by vehicle_id;
grant select on public.vehicle_rating_stats to anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- ХАРЕСВАНИЯ
-- ═════════════════════════════════════════════════════════════
create table if not exists public.photo_likes (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (photo_id, user_id)
);
create index if not exists photo_likes_user_idx on public.photo_likes (user_id);
alter table public.photo_likes enable row level security;
drop policy if exists "likes_read" on public.photo_likes;
drop policy if exists "likes_own_ins" on public.photo_likes;
drop policy if exists "likes_own_del" on public.photo_likes;
create policy "likes_read" on public.photo_likes for select to anon, authenticated using (true);
create policy "likes_own_ins" on public.photo_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.photos p where p.id = photo_id and p.status = 'approved'));
create policy "likes_own_del" on public.photo_likes for delete to authenticated using (user_id = (select auth.uid()));
grant select on public.photo_likes to anon, authenticated;
grant insert, delete on public.photo_likes to authenticated;

-- ═════════════════════════════════════════════════════════════
-- КОМЕНТАРИ (отговори на едно ниво, след одобрение от админа)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.photo_comments (
  id          bigint generated always as identity primary key,
  photo_id    uuid not null references public.photos(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  parent_id   bigint references public.photo_comments(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists photo_comments_photo_idx on public.photo_comments (photo_id, created_at);
create index if not exists photo_comments_status_idx on public.photo_comments (status, created_at);

create or replace function public.comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := public.is_admin();
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    -- Отговорът е само на едно ниво
    if new.parent_id is not null and exists (select 1 from public.photo_comments where id = new.parent_id and parent_id is not null) then
      raise exception 'one_level_only';
    end if;
    -- Лимит: до 10 коментара на час
    if (select count(*) from public.photo_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limit';
    end if;
    if not exists (select 1 from public.photos where id = new.photo_id and status = 'approved') then
      raise exception 'photo_not_found';
    end if;
    new.user_id := auth.uid();
    new.status := case when admin then 'approved' else 'pending' end;
    new.reviewed_at := case when admin then now() end;
    new.created_at := now();
    return new;
  end if;
  if not admin then raise exception 'not_allowed'; end if;   -- променя (одобрява) само админът
  return new;
end;
$$;
drop trigger if exists comments_guard on public.photo_comments;
create trigger comments_guard before insert or update on public.photo_comments
  for each row execute function public.comments_guard();

alter table public.photo_comments enable row level security;
drop policy if exists "comments_read" on public.photo_comments;
drop policy if exists "comments_ins"  on public.photo_comments;
drop policy if exists "comments_upd"  on public.photo_comments;
drop policy if exists "comments_del"  on public.photo_comments;
create policy "comments_read" on public.photo_comments for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "comments_ins" on public.photo_comments for insert to authenticated with check (true);
create policy "comments_upd" on public.photo_comments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "comments_del" on public.photo_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.photo_comments to anon, authenticated;
grant insert, delete on public.photo_comments to authenticated;
grant update (status, reviewed_at) on public.photo_comments to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ДОКЛАДВАНИЯ
-- ═════════════════════════════════════════════════════════════
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  target_type text not null check (target_type in ('comment', 'photo', 'sighting', 'spotter')),
  target_id   text not null check (char_length(target_id) <= 64),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  reason      text check (char_length(reason) <= 300),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);
alter table public.reports enable row level security;
drop policy if exists "reports_ins" on public.reports;
drop policy if exists "reports_admin" on public.reports;
drop policy if exists "reports_admin_upd" on public.reports;
create policy "reports_ins" on public.reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy "reports_admin" on public.reports for select to authenticated using ((select public.is_admin()));
create policy "reports_admin_upd" on public.reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert on public.reports to authenticated;
grant update (resolved) on public.reports to authenticated;

-- ═════════════════════════════════════════════════════════════
-- СЛЕДВАНЕ (спотър, кола, линия)
-- ═════════════════════════════════════════════════════════════
create table if not exists public.follows (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('spotter', 'vehicle', 'line')),
  target_id    text not null check (char_length(target_id) between 1 and 64),
  created_at   timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists follows_target_idx on public.follows (target_type, target_id);
alter table public.follows enable row level security;
drop policy if exists "follows_own" on public.follows;
create policy "follows_own" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.follows to authenticated;

-- ═════════════════════════════════════════════════════════════
-- Профил: нови видове имейли, които спотърът може да спре
-- ═════════════════════════════════════════════════════════════
-- (email_prefs вече съществува: photo_review, owner_vote; поканите идват винаги)
