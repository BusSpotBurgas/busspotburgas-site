-- busspotburgas · Етап 1: основа
-- Модели, коли, профили и роли. RLS е включен за всяка таблица.
-- Безопасно е да се пусне повече от веднъж.

-- ─────────────────────────────────────────────────────────────
-- Типове
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.vehicle_status as enum ('run', 'new', 'stop', 'off', 'scrapped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('spotter', 'admin');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Модели
-- ─────────────────────────────────────────────────────────────
create table if not exists public.models (
  id          text primary key,                 -- напр. 'u12'
  name        text not null,                    -- 'Solaris Urbino III 12 CNG'
  type_bg     text not null,
  type_en     text not null,
  since       text,                             -- в Бургас от
  color       text not null default '#0B6FA4',  -- цвят на модела в сайта
  silhouette  text not null default '12m'
              check (silhouette in ('12m', '18m', '9m', 'mini', 'trolley')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Коли
-- ─────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id               bigint generated always as identity primary key,
  fleet_number     text not null unique,        -- инвентарен номер, напр. '0437'
  model_id         text not null references public.models(id) on update cascade,
  status           public.vehicle_status not null default 'run',
  reg_number       text,
  garage           text,
  built_year       int  check (built_year between 1950 and 2100),
  in_service_since date,
  old_numbers      text[] not null default '{}',
  -- технически данни
  length_m         numeric(4,2),
  doors            int,
  seats            int,
  fuel             text,
  -- стари бракувани коли (Икарус, Чавдар, ЗиУ) – само за архива
  is_historic      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists vehicles_model_idx  on public.vehicles(model_id);
create index if not exists vehicles_status_idx on public.vehicles(status);

-- ─────────────────────────────────────────────────────────────
-- Профили (по един за всеки акаунт от Supabase Auth)
-- Имейлът НЕ се пази тук – той стои само в auth.users.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) between 2 and 32),
  avatar_url    text,
  cover_url     text,
  tiktok        text check (char_length(tiktok) <= 64),
  role          public.user_role not null default 'spotter',
  locale        text not null default 'bg' check (locale in ('bg', 'en')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Помощни функции
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_touch on public.vehicles;
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Нов акаунт → празен профил (ролята винаги е 'spotter')
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.models   enable row level security;
alter table public.vehicles enable row level security;
alter table public.profiles enable row level security;

-- Модели и коли: всеки чете, само админ пише
drop policy if exists "models_read"        on public.models;
drop policy if exists "models_admin_write" on public.models;
create policy "models_read" on public.models
  for select to anon, authenticated using (true);
create policy "models_admin_write" on public.models
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "vehicles_read"        on public.vehicles;
drop policy if exists "vehicles_admin_write" on public.vehicles;
create policy "vehicles_read" on public.vehicles
  for select to anon, authenticated using (true);
create policy "vehicles_admin_write" on public.vehicles
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Профили: публични за четене, всеки редактира само своя
drop policy if exists "profiles_read"       on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Спотърът може да сменя само тези полета – НЕ и ролята си
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, cover_url, tiktok, locale)
  on public.profiles to authenticated;

revoke insert, update, delete on public.models, public.vehicles from anon;


-- busspotburgas · права за достъп
-- Новите Supabase проекти не дават автоматично права на ролите anon/authenticated.
-- Тук ги даваме изрично; кой какво реално вижда/пише решават RLS правилата от 0001.

grant usage on schema public to anon, authenticated;

-- Четене: всички
grant select on public.models, public.vehicles, public.profiles to anon, authenticated;

-- Писане по коли и модели: само влезли (RLS пуска само админа)
grant insert, update, delete on public.models, public.vehicles to authenticated;

-- Профил: само тези полета, НЕ ролята
grant update (display_name, avatar_url, cover_url, tiktok, locale) on public.profiles to authenticated;


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


-- busspotburgas · Етап 3: снимки, одобрение, спорове
-- Безопасно е да се пусне повече от веднъж.

-- ─────────────────────────────────────────────────────────────
-- Типове
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.photo_kind as enum ('exterior', 'interior', 'cab', 'depot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Снимки
-- Файлове: photos-private/<user>/<id>/{original,display,thumb} (WebP, на iPhone – JPEG)
-- При одобрение display + thumb се преместват в photos-public/<id>/…
-- ─────────────────────────────────────────────────────────────
create table if not exists public.photos (
  id              uuid primary key,
  vehicle_id      bigint not null references public.vehicles(id) on update cascade,
  user_id         uuid references public.profiles(id) on delete set null, -- null = „Бивш спотър“
  author_name     text,           -- името, изписано във водния знак
  status          public.photo_status not null default 'pending',
  kind            public.photo_kind not null,
  line            text not null check (char_length(line) between 1 and 12),
  place           text not null check (char_length(place) between 2 and 80),
  ad              text check (char_length(ad) <= 80),
  description     text check (char_length(description) <= 500),
  rights_shared   boolean not null default false,
  width           int  check (width between 100 and 4096),
  height          int  check (height between 100 and 4096),
  dhash           text check (dhash ~ '^[0-9a-f]{16}$'),
  is_night        boolean not null default false,
  is_rain         boolean not null default false,
  reject_reason   text check (reject_reason in ('blurry', 'wrong_number', 'duplicate', 'not_own', 'other')),
  reject_note     text check (char_length(reject_note) <= 300),
  edited_by_admin boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.profiles(id) on delete set null
);

create index if not exists photos_vehicle_idx on public.photos (vehicle_id, status, created_at desc);
create index if not exists photos_user_idx    on public.photos (user_id, created_at desc);
create index if not exists photos_status_idx  on public.photos (status, created_at);

-- Само за автора и админа: кога е снимано (от EXIF)
create table if not exists public.photo_private (
  photo_id  uuid primary key references public.photos(id) on delete cascade,
  taken_at  timestamptz
);

-- „Това е моя снимка“ – спор за авторство
create table if not exists public.photo_claims (
  id          bigint generated always as identity primary key,
  photo_id    uuid not null references public.photos(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  note        text check (char_length(note) <= 300),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (photo_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- Правила при запис (не вярваме на браузъра)
-- ─────────────────────────────────────────────────────────────
create or replace function public.photos_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := public.is_admin();
begin
  -- Системни операции (сървърът със секретния ключ, изтриване на акаунт → „Бивш спотър“)
  -- нямат влязъл потребител; anon няма права за запис изобщо.
  if auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() and not admin then
      raise exception 'not_owner';
    end if;
    if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
      raise exception 'email_not_confirmed';
    end if;
    -- Снимките на админа излизат веднага; останалите чакат одобрение
    new.status := case when admin then 'approved'::public.photo_status else 'pending' end;
    new.reviewed_at := case when admin then now() end;
    new.reviewed_by := case when admin then auth.uid() end;
    new.is_night := false; new.is_rain := false;
    new.reject_reason := null; new.reject_note := null; new.edited_by_admin := false;
    select coalesce(display_name, 'спотър') into new.author_name from public.profiles where id = new.user_id;
    return new;
  end if;

  -- UPDATE
  new.updated_at := now();
  if admin then
    return new;
  end if;
  -- Авторът: само докато чака или е отказана; не може да променя статуса и админ полетата
  if old.user_id is distinct from auth.uid() or old.status = 'approved' then
    raise exception 'not_allowed';
  end if;
  new.id := old.id; new.user_id := old.user_id; new.author_name := old.author_name;
  new.width := old.width; new.height := old.height; new.dhash := old.dhash;
  new.is_night := old.is_night; new.is_rain := old.is_rain;
  new.edited_by_admin := old.edited_by_admin; new.created_at := old.created_at;
  new.reviewed_at := null; new.reviewed_by := null;
  new.reject_reason := null; new.reject_note := null;
  new.status := 'pending'; -- поправената снимка отива отново за одобрение
  return new;
end;
$$;

drop trigger if exists photos_guard on public.photos;
create trigger photos_guard before insert or update on public.photos
  for each row execute function public.photos_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.photos        enable row level security;
alter table public.photo_private enable row level security;
alter table public.photo_claims  enable row level security;

drop policy if exists "photos_read"          on public.photos;
drop policy if exists "photos_insert_own"    on public.photos;
drop policy if exists "photos_update"        on public.photos;
drop policy if exists "photos_delete"        on public.photos;
create policy "photos_read" on public.photos for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "photos_insert_own" on public.photos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "photos_update" on public.photos for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()) or user_id is null);
create policy "photos_delete" on public.photos for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "photo_private_read"   on public.photo_private;
drop policy if exists "photo_private_insert" on public.photo_private;
create policy "photo_private_read" on public.photo_private for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.photos p where p.id = photo_id and p.user_id = (select auth.uid())));
create policy "photo_private_insert" on public.photo_private for insert to authenticated
  with check (exists (
    select 1 from public.photos p where p.id = photo_id and p.user_id = (select auth.uid())));

drop policy if exists "claims_read"   on public.photo_claims;
drop policy if exists "claims_insert" on public.photo_claims;
drop policy if exists "claims_admin"  on public.photo_claims;
create policy "claims_read" on public.photo_claims for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "claims_insert" on public.photo_claims for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "claims_admin" on public.photo_claims for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.photos to anon, authenticated;
grant insert, update, delete on public.photos to authenticated;
grant select, insert on public.photo_private to authenticated;
grant select, insert, update on public.photo_claims to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Помощни функции
-- ─────────────────────────────────────────────────────────────

-- Еднакви снимки: сравнение на „отпечатъка“ (dHash, 64 бита)
create or replace function public.find_similar_photos(p_dhash text)
returns table (photo_id uuid, author_name text, fleet_number text, distance int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.author_name, 'Бивш спотър'), v.fleet_number,
         bit_count(('x' || p.dhash)::bit(64) # ('x' || p_dhash)::bit(64))::int as distance
  from public.photos p
  join public.vehicles v on v.id = p.vehicle_id
  where p.dhash is not null
    and p_dhash ~ '^[0-9a-f]{16}$'
    and p.status <> 'rejected'
    and bit_count(('x' || p.dhash)::bit(64) # ('x' || p_dhash)::bit(64)) <= 6
  order by distance
  limit 3;
$$;
revoke all on function public.find_similar_photos(text) from public, anon;
grant execute on function public.find_similar_photos(text) to authenticated;

-- Брой одобрени снимки по кола + последната (за картите в автопарка)
create or replace view public.vehicle_photo_stats
with (security_invoker = true) as
select v.id as vehicle_id, v.fleet_number,
       count(p.id) filter (where p.status = 'approved') as photo_count,
       (array_agg(p.id order by p.created_at desc) filter (where p.status = 'approved'))[1] as cover_photo_id
from public.vehicles v
left join public.photos p on p.vehicle_id = v.id
group by v.id, v.fleet_number;
grant select on public.vehicle_photo_stats to anon, authenticated;

-- Заето място в хранилището (само за админа)
create or replace function public.storage_usage()
returns table (bucket text, files bigint, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, count(*), coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects o
  where public.is_admin() or coalesce((select auth.role()), '') = 'service_role'
  group by o.bucket_id;
$$;
revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- Хранилище
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos-private', 'photos-private', false, 3145728, array['image/webp', 'image/jpeg']),
  ('photos-public',  'photos-public',  true,  3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Частните: всеки качва/вижда само своята папка; админът вижда всичко
drop policy if exists "photos_private_insert" on storage.objects;
drop policy if exists "photos_private_select" on storage.objects;
drop policy if exists "photos_private_delete" on storage.objects;
create policy "photos_private_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_private_select" on storage.objects for select to authenticated
  using (bucket_id = 'photos-private' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "photos_private_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos-private' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
-- photos-public: пише само сървърът (секретният ключ) при одобрение


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


-- Автоматично от data/fleet.json (trinmo.org, Бургасбус ЕООД, проверено 16.11.2026). Не редактирай на ръка.
-- 9 модела, 166 коли.

insert into public.models (id, name, type_bg, type_en, since, color, silhouette, sort_order) values
('u12', 'Solaris Urbino III 12 CNG', 'Автобус · газ', 'Bus · CNG', '19.02.2013', '#0B6FA4', '12m', 1),
('u18', 'Solaris Urbino III 18', 'Съчленен · дизел', 'Articulated · diesel', '19.02.2013', '#1E3A8A', '18m', 3),
('u18m', 'Solaris Urbino III 18 MetroStyle', 'Съчленен · MetroStyle', 'Articulated · MetroStyle', '15.02.2017', '#7C3AED', '18m', 7),
('i12', 'Irizar ie bus 12', 'Електробус', 'Electric bus', '2022', '#0EA5A0', '12m', 2),
('i18', 'Irizar ie bus 18', 'Електробус · съчленен', 'Electric · articulated', '2021', '#0F766E', '18m', 6),
('y9', 'Yutong E9', 'Електробус · 9 м', 'Electric bus · 9 m', '01.2022', '#16A34A', '9m', 5),
('tr', 'Škoda 26Tr Solaris III', 'Тролейбус', 'Trolleybus', '2014', '#EA580C', 'trolley', 4),
('kj', 'Karsan Jest+', 'Минибус', 'Minibus', '2016', '#DB2777', 'mini', 8),
('ka', 'Karsan Atak', 'Мидибус', 'Midibus', '2019', '#CA8A04', '9m', 9)
on conflict (id) do update set
  name = excluded.name, type_bg = excluded.type_bg, type_en = excluded.type_en,
  since = excluded.since, color = excluded.color, silhouette = excluded.silhouette,
  sort_order = excluded.sort_order;

-- Нови коли се добавят; на съществуващите се обновяват само модел и статус.
insert into public.vehicles (fleet_number, model_id, status) values
('3438', 'u12', 'run'),
('3439', 'u12', 'run'),
('3440', 'u12', 'run'),
('3442', 'u12', 'run'),
('3445', 'u12', 'run'),
('3446', 'u12', 'run'),
('3447', 'u12', 'run'),
('3448', 'u12', 'run'),
('3449', 'u12', 'run'),
('3450', 'u12', 'run'),
('3452', 'u12', 'run'),
('3453', 'u12', 'run'),
('3455', 'u12', 'run'),
('3913', 'u12', 'run'),
('3914', 'u12', 'run'),
('3915', 'u12', 'run'),
('3916', 'u12', 'run'),
('3917', 'u12', 'run'),
('3918', 'u12', 'run'),
('3920', 'u12', 'run'),
('3921', 'u12', 'run'),
('3922', 'u12', 'run'),
('3924', 'u12', 'run'),
('3926', 'u12', 'run'),
('3927', 'u12', 'run'),
('3930', 'u12', 'run'),
('3931', 'u12', 'run'),
('3934', 'u12', 'run'),
('3941', 'u12', 'run'),
('3944', 'u12', 'run'),
('4176', 'u12', 'run'),
('4177', 'u12', 'run'),
('4178', 'u12', 'run'),
('4179', 'u12', 'run'),
('4180', 'u12', 'run'),
('4181', 'u12', 'run'),
('4182', 'u12', 'run'),
('4183', 'u12', 'run'),
('4184', 'u12', 'run'),
('2941', 'u18', 'run'),
('2942', 'u18', 'run'),
('2943', 'u18', 'run'),
('2944', 'u18', 'run'),
('2946', 'u18', 'run'),
('2947', 'u18', 'run'),
('2948', 'u18', 'run'),
('2950', 'u18', 'run'),
('2951', 'u18', 'run'),
('2952', 'u18', 'run'),
('2953', 'u18', 'run'),
('2954', 'u18', 'run'),
('2955', 'u18', 'run'),
('2956', 'u18', 'run'),
('2958', 'u18', 'run'),
('2960', 'u18', 'run'),
('2961', 'u18', 'run'),
('2963', 'u18', 'run'),
('2964', 'u18', 'run'),
('2965', 'u18', 'run'),
('2966', 'u18', 'run'),
('2967', 'u18', 'run'),
('2968', 'u18', 'run'),
('2970', 'u18', 'run'),
('2971', 'u18', 'run'),
('2972', 'u18', 'run'),
('2973', 'u18', 'run'),
('2974', 'u18', 'run'),
('8599', 'u18m', 'run'),
('8600', 'u18m', 'run'),
('9185', 'u18m', 'run'),
('9186', 'u18m', 'run'),
('9187', 'u18m', 'run'),
('9188', 'u18m', 'run'),
('9193', 'u18m', 'run'),
('0437', 'i12', 'run'),
('0438', 'i12', 'run'),
('0439', 'i12', 'run'),
('0441', 'i12', 'run'),
('0443', 'i12', 'run'),
('0634', 'i12', 'run'),
('0635', 'i12', 'run'),
('0636', 'i12', 'run'),
('0876', 'i12', 'run'),
('0877', 'i12', 'run'),
('0878', 'i12', 'run'),
('1203', 'i12', 'run'),
('1205', 'i12', 'run'),
('1206', 'i12', 'run'),
('1664', 'i12', 'run'),
('1667', 'i12', 'run'),
('2408', 'i12', 'run'),
('2409', 'i12', 'run'),
('2410', 'i12', 'run'),
('2411', 'i12', 'run'),
('2413', 'i12', 'run'),
('2414', 'i12', 'run'),
('2416', 'i12', 'run'),
('2418', 'i12', 'run'),
('2419', 'i12', 'run'),
('2885', 'i12', 'run'),
('2889', 'i12', 'run'),
('3818', 'i12', 'run'),
('3819', 'i12', 'run'),
('4157', 'i12', 'run'),
('4374', 'i12', 'run'),
('4375', 'i12', 'run'),
('4376', 'i12', 'run'),
('4377', 'i12', 'run'),
('4154', 'i18', 'run'),
('4155', 'i18', 'run'),
('4156', 'i18', 'run'),
('4798', 'i18', 'run'),
('4799', 'i18', 'run'),
('6403', 'i18', 'run'),
('6404', 'i18', 'run'),
('7084', 'i18', 'run'),
('7085', 'i18', 'run'),
('7820', 'i18', 'run'),
('7097', 'y9', 'run'),
('7679', 'y9', 'run'),
('7681', 'y9', 'run'),
('7682', 'y9', 'run'),
('7684', 'y9', 'run'),
('7685', 'y9', 'run'),
('7687', 'y9', 'run'),
('7688', 'y9', 'run'),
('7690', 'y9', 'run'),
('7692', 'y9', 'run'),
('7694', 'y9', 'run'),
('7701', 'y9', 'run'),
('8449', 'y9', 'new'),
('8450', 'y9', 'new'),
('8452', 'y9', 'new'),
('8453', 'y9', 'new'),
('8454', 'y9', 'new'),
('13339', 'tr', 'run'),
('13342', 'tr', 'run'),
('13345', 'tr', 'run'),
('13523', 'tr', 'run'),
('13527', 'tr', 'run'),
('13528', 'tr', 'run'),
('13529', 'tr', 'run'),
('13340', 'tr', 'stop'),
('13341', 'tr', 'stop'),
('13343', 'tr', 'stop'),
('13346', 'tr', 'stop'),
('13347', 'tr', 'stop'),
('13526', 'tr', 'stop'),
('13530', 'tr', 'stop'),
('13531', 'tr', 'stop'),
('13534', 'tr', 'stop'),
('13535', 'tr', 'stop'),
('13344', 'tr', 'off'),
('13524', 'tr', 'off'),
('13525', 'tr', 'off'),
('13532', 'tr', 'off'),
('13533', 'tr', 'off'),
('9547', 'kj', 'run'),
('9549', 'kj', 'run'),
('9554', 'kj', 'run'),
('9558', 'kj', 'run'),
('9561', 'kj', 'run'),
('9552', 'kj', 'stop'),
('1679', 'ka', 'run'),
('1681', 'ka', 'run'),
('1680', 'ka', 'stop')
on conflict (fleet_number) do update set
  model_id = excluded.model_id, status = excluded.status;

select count(*) as "коли в базата" from public.vehicles;
