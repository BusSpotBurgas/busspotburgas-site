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
