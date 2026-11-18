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
