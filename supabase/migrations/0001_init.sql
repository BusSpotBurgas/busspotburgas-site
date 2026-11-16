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
