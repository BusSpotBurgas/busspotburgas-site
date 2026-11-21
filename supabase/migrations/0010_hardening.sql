-- busspotburgas · Етап 7: затягане по Security Advisor на Supabase
-- Нищо не се променя за спотърите – само по-строги правила „за всеки случай“.

-- 1) Фиксиран search_path и на двете малки помощни функции
alter function public.rank_of(int) set search_path = '';
alter function public.potm_window() set search_path = '';

-- 2) Служебните (тригерни) функции не могат да се викат отвън през API.
--    Тригерите продължават да работят – при задействане PostgreSQL не проверява EXECUTE.
revoke execute on function public.comments_guard()   from public, anon, authenticated;
revoke execute on function public.comments_points()  from public, anon, authenticated;
revoke execute on function public.handle_new_user()  from public, anon, authenticated;
revoke execute on function public.on_owner_left()    from public, anon, authenticated;
revoke execute on function public.photos_guard()     from public, anon, authenticated;
revoke execute on function public.photos_points()    from public, anon, authenticated;
revoke execute on function public.ratings_points()   from public, anon, authenticated;
revoke execute on function public.videos_guard()     from public, anon, authenticated;
revoke execute on function public.videos_points()    from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 3) Коментари и видео: авторът изрично трябва да е влезлият спотър
--    (тригерът и без това го записва – това е втора защита).
drop policy if exists "comments_ins" on public.photo_comments;
create policy "comments_ins" on public.photo_comments for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "videos_ins" on public.videos;
create policy "videos_ins" on public.videos for insert to authenticated
  with check (user_id = (select auth.uid()));
