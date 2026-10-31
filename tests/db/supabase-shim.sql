-- Imitación mínima de lo que Supabase trae de fábrica, para correr las
-- migraciones en una base de prueba local (PGlite) sin cuenta ni Docker.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (id uuid primary key);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase da permisos amplios por defecto; las migraciones tienen que achicarlos.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
