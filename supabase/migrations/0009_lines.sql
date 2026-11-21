-- busspotburgas · Етап 6: линии и разписания
-- Данните идват от официалния GTFS на Бургасбус (scripts/import-gtfs.mjs).
-- Всички четат; пише само сървърът (секретният ключ).

create table if not exists public.transit_lines (
  id          text primary key check (char_length(id) between 1 and 12),  -- „15“, „Б1“, „Т2“
  kind        text not null check (kind in ('bus', 'express', 'trolley')),
  name        text,                                                        -- „ж.к. Меден рудник – Център“
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

-- Посоките на линията: спирките по ред и часовете на тръгване от първата спирка
create table if not exists public.transit_directions (
  id          bigint generated always as identity primary key,
  line_id     text not null references public.transit_lines(id) on delete cascade,
  direction   smallint not null check (direction in (0, 1)),
  headsign    text,
  stops       text[] not null default '{}',
  weekday     text[] not null default '{}',   -- „05:30“, „05:50“ …
  saturday    text[] not null default '{}',
  sunday      text[] not null default '{}',
  unique (line_id, direction)
);

create table if not exists public.transit_meta (
  key   text primary key,
  value text not null
);

alter table public.transit_lines      enable row level security;
alter table public.transit_directions enable row level security;
alter table public.transit_meta       enable row level security;

drop policy if exists "transit_lines_read" on public.transit_lines;
create policy "transit_lines_read" on public.transit_lines for select to anon, authenticated using (true);
drop policy if exists "transit_directions_read" on public.transit_directions;
create policy "transit_directions_read" on public.transit_directions for select to anon, authenticated using (true);
drop policy if exists "transit_meta_read" on public.transit_meta;
create policy "transit_meta_read" on public.transit_meta for select to anon, authenticated using (true);

grant select on public.transit_lines, public.transit_directions, public.transit_meta to anon, authenticated;
grant all on public.transit_lines, public.transit_directions, public.transit_meta to service_role;
