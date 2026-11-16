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
