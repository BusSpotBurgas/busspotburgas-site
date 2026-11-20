-- busspotburgas · права за сървъра (секретния ключ, service_role)
-- Новите Supabase проекти не дават автоматично права дори на service_role.
-- Сървърът ги ползва за известия, push, имейли и нощните задачи. RLS не важи за него.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- И за таблиците, които ще се създават в бъдеще
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
