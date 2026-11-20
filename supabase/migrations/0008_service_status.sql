-- busspotburgas · статус „В сервиз“ и обновяване на автопарка (20.11.2026)
-- (стойността service в типа vehicle_status се добавя отделно:
--  alter type public.vehicle_status add value if not exists 'service' after 'stop';)

-- Колите в сервиз остават активни: могат да имат титуляри и покани за ортак
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
  if v.is_historic or v.status not in ('run', 'new', 'stop', 'service') then return 'inactive'; end if;

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
  if not found or v.is_historic or v.status not in ('run', 'new', 'stop', 'service') then return 'inactive'; end if;
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

-- Статуси по информация от собственика на сайта
update public.vehicles set status = 'scrapped' where fleet_number = '3921';
update public.vehicles set status = 'service' where fleet_number in ('3447', '3448', '4182', '3926');
