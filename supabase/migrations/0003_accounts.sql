-- busspotburgas · Етап 2: акаунти, профили, титуляри
-- Безопасно е да се пусне повече от веднъж.

-- ─────────────────────────────────────────────────────────────
-- Профили: съгласия и стъпки на регистрацията
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists age_confirmed     boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists onboarding_step   text not null default 'consent',
  add column if not exists email_prefs       jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.profiles add constraint profiles_onboarding_step_check
    check (onboarding_step in ('consent', 'profile', 'holders', 'tour', 'done'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_display_name_chars
    check (display_name !~ '[<>"\\/{}]');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_tiktok_chars
    check (tiktok ~ '^[A-Za-z0-9._]{2,24}$');
exception when duplicate_object then null; end $$;

-- Едно и също показвано име не може да се ползва от двама (без значение главни/малки)
create unique index if not exists profiles_display_name_unique
  on public.profiles (lower(display_name));

-- Нов акаунт → профил. При имейл регистрация съгласията идват от формата.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  age_ok  boolean := coalesce((meta->>'age_confirmed') = 'true', false);
  term_ok boolean := coalesce((meta->>'terms_accepted') = 'true', false);
  loc     text := case when meta->>'locale' in ('bg', 'en') then meta->>'locale' else 'bg' end;
begin
  insert into public.profiles (id, age_confirmed, terms_accepted_at, locale, onboarding_step)
  values (
    new.id,
    age_ok,
    case when term_ok then now() end,
    loc,
    case when age_ok and term_ok then 'profile' else 'consent' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Спотърът може да сменя и тези полета (ролята – никога)
grant update (age_confirmed, terms_accepted_at, onboarding_step, email_prefs)
  on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Админ: роля 'admin' + влязъл С КОД от приложение (2FA, aal2)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()->>'aal'), '') = 'aal2'
     and exists (
       select 1 from public.profiles
       where id = (select auth.uid()) and role = 'admin'
     );
$$;

-- ─────────────────────────────────────────────────────────────
-- Титуляри
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.holder_role as enum ('owner', 'partner');
exception when duplicate_object then null; end $$;

create table if not exists public.vehicle_holders (
  vehicle_id  bigint not null references public.vehicles(id) on delete cascade,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  role        public.holder_role not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
-- Всяка кола има най-много един собственик
create unique index if not exists vehicle_holders_one_owner
  on public.vehicle_holders (vehicle_id) where role = 'owner';
create index if not exists vehicle_holders_user_idx on public.vehicle_holders (user_id);

-- „Нямам титуляр“ за даден модел
create table if not exists public.model_no_holder (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  model_id  text not null references public.models(id) on delete cascade,
  primary key (user_id, model_id)
);

alter table public.vehicle_holders enable row level security;
alter table public.model_no_holder enable row level security;

drop policy if exists "holders_read" on public.vehicle_holders;
create policy "holders_read" on public.vehicle_holders
  for select to anon, authenticated using (true);

drop policy if exists "no_holder_read" on public.model_no_holder;
create policy "no_holder_read" on public.model_no_holder
  for select to anon, authenticated using (true);

-- Директно писане няма – само през функциите по-долу, които проверяват правилата
grant select on public.vehicle_holders, public.model_no_holder to anon, authenticated;
revoke insert, update, delete on public.vehicle_holders, public.model_no_holder from anon, authenticated;

-- Вземи кола за титуляр. Връща: 'owner' | 'already' | 'taken' | 'inactive' | 'not_found'
create or replace function public.claim_vehicle(p_fleet_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v   record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = uid and age_confirmed) then
    raise exception 'consent_required';
  end if;

  select id, model_id, status, is_historic into v
  from public.vehicles where fleet_number = p_fleet_number;
  if not found then return 'not_found'; end if;
  if v.is_historic or v.status not in ('run', 'new', 'stop') then return 'inactive'; end if;

  if exists (select 1 from public.vehicle_holders where vehicle_id = v.id and user_id = uid) then
    return 'already';
  end if;

  begin
    insert into public.vehicle_holders (vehicle_id, user_id, role) values (v.id, uid, 'owner');
  exception when unique_violation then
    return 'taken';  -- има собственик → покана за ортак (Етап 4)
  end;

  delete from public.model_no_holder where user_id = uid and model_id = v.model_id;
  return 'owner';
end;
$$;

-- Откажи се от кола. Връща: 'released' | 'not_holder' | 'has_partners'
create or replace function public.release_vehicle(p_fleet_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  h   record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select vh.vehicle_id, vh.role into h
  from public.vehicle_holders vh
  join public.vehicles v on v.id = vh.vehicle_id
  where v.fleet_number = p_fleet_number and vh.user_id = uid;
  if not found then return 'not_holder'; end if;

  -- Собственик с ортаци: гласуване за нов собственик идва в Етап 4
  if h.role = 'owner' and exists (
    select 1 from public.vehicle_holders where vehicle_id = h.vehicle_id and role = 'partner'
  ) then
    return 'has_partners';
  end if;

  delete from public.vehicle_holders where vehicle_id = h.vehicle_id and user_id = uid;
  return 'released';
end;
$$;

-- „Нямам титуляр“ за модел. Връща: 'ok' | 'has_holders'
create or replace function public.set_no_holder(p_model_id text, p_value boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_value then
    if exists (
      select 1 from public.vehicle_holders vh
      join public.vehicles v on v.id = vh.vehicle_id
      where vh.user_id = uid and v.model_id = p_model_id
    ) then
      return 'has_holders';
    end if;
    insert into public.model_no_holder (user_id, model_id) values (uid, p_model_id)
    on conflict do nothing;
  else
    delete from public.model_no_holder where user_id = uid and model_id = p_model_id;
  end if;
  return 'ok';
end;
$$;

revoke all on function public.claim_vehicle(text), public.release_vehicle(text),
  public.set_no_holder(text, boolean) from public, anon;
grant execute on function public.claim_vehicle(text), public.release_vehicle(text),
  public.set_no_holder(text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Снимки на профила (Storage)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Всеки качва само в своята папка: avatars/<user id>/...
drop policy if exists "avatars_own_select" on storage.objects;
drop policy if exists "avatars_own_insert" on storage.objects;
drop policy if exists "avatars_own_update" on storage.objects;
drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─────────────────────────────────────────────────────────────
-- Забрана за временни имейли (Auth Hook „Before User Created“)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.blocked_email_domains (domain text primary key);
alter table public.blocked_email_domains enable row level security;
revoke all on public.blocked_email_domains from anon, authenticated;
-- RLS скрива редовете и от Supabase Auth – затова изрично правило само за него
drop policy if exists "auth_admin_read" on public.blocked_email_domains;
create policy "auth_admin_read" on public.blocked_email_domains for select to supabase_auth_admin using (true);

insert into public.blocked_email_domains (domain) values
  ('10minutemail.com'), ('10minutemail.net'), ('10minemail.com'), ('20minutemail.com'),
  ('temp-mail.org'), ('temp-mail.io'), ('tempmail.com'), ('tempmail.net'), ('tempmail.dev'),
  ('tempmailo.com'), ('tempr.email'), ('tempinbox.com'), ('temporary-mail.net'),
  ('guerrillamail.com'), ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamail.biz'),
  ('guerrillamail.de'), ('guerrillamailblock.com'), ('sharklasers.com'), ('grr.la'), ('pokemail.net'),
  ('spam4.me'), ('mailinator.com'), ('mailinator.net'), ('mailinator2.com'), ('mailnesia.com'),
  ('yopmail.com'), ('yopmail.net'), ('yopmail.fr'), ('cool.fr.nf'), ('jetable.fr.nf'),
  ('throwawaymail.com'), ('trashmail.com'), ('trashmail.de'), ('trashmail.net'), ('trash-mail.com'),
  ('dispostable.com'), ('getnada.com'), ('nada.email'), ('maildrop.cc'), ('mohmal.com'),
  ('emailondeck.com'), ('fakeinbox.com'), ('fakemail.net'), ('mintemail.com'), ('mytemp.email'),
  ('mailcatch.com'), ('mail-temp.com'), ('moakt.com'), ('emailfake.com'), ('tempail.com'),
  ('burnermail.io'), ('spamgourmet.com'), ('discard.email'), ('dropmail.me'), ('1secmail.com'),
  ('1secmail.net'), ('1secmail.org'), ('mailpoof.com'), ('inboxkitten.com'), ('mail.tm'),
  ('tmail.ws'), ('tmpmail.org'), ('tmpmail.net'), ('mailsac.com'), ('harakirimail.com'),
  ('spambox.us'), ('incognitomail.org'), ('anonbox.net'), ('emltmp.com'), ('linshiyouxiang.net'),
  ('mailto.plus'), ('fexpost.com'), ('fexbox.org'), ('rover.info'), ('inbox.lv.temp'),
  ('cuvox.de'), ('dayrep.com'), ('einrot.com'), ('fleckens.hu'), ('gustr.com'), ('jourrapide.com'),
  ('rhyta.com'), ('superrito.com'), ('teleworm.us'), ('armyspy.com'), ('byom.de'), ('wegwerfmail.de'),
  ('wegwerfemail.de'), ('spamfree24.org'), ('emailtemporanea.net'), ('correotemporal.org'),
  ('minuteinbox.com'), ('tempmailaddress.com'), ('luxusmail.org'), ('getairmail.com'),
  ('mailnull.com'), ('owlymail.com'), ('vomoto.com'), ('kzccv.com'), ('qiott.com'), ('wuuvo.com')
on conflict do nothing;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  email  text := lower(coalesce(event->'user'->>'email', ''));
  v_domain text := split_part(email, '@', 2);
begin
  if v_domain <> '' and exists (
    select 1 from public.blocked_email_domains b
    where v_domain = b.domain or v_domain like '%.' || b.domain
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'disposable_email'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant select on public.blocked_email_domains to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Почистване: непотвърдени акаунти се трият след 7 дни (всяка нощ в 03:15)
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
select cron.schedule(
  'delete-unconfirmed-users',
  '15 3 * * *',
  $$delete from auth.users where email_confirmed_at is null and created_at < now() - interval '7 days'$$
);
