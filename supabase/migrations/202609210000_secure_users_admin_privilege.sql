-- Protect public.users.is_admin before applying the NOBI V2 engagement migration.
-- This migration intentionally leaves existing SELECT privileges unchanged.
begin;

-- Fail closed if production has gained columns that have not been classified yet.
do $$
declare
  actual_columns text[];
  expected_columns constant text[] := array['created_at', 'email', 'id', 'is_admin'];
begin
  select array_agg(columns.column_name order by columns.column_name)
  into actual_columns
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'users';

  if actual_columns is distinct from expected_columns then
    raise exception 'public.users columns changed; expected %, found %. Review privileges before continuing.',
      expected_columns,
      actual_columns;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    raise exception 'public.users.id must be uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_admin'
      and data_type = 'boolean'
  ) then
    raise exception 'public.users.is_admin must be boolean';
  end if;
end
$$;

alter table public.users enable row level security;

-- Table-level grants imply the corresponding privilege on every column. Revoke both
-- table-level and any explicit column-level grants, including privileges inherited
-- through PUBLIC. Browser roles retain no direct write path to public.users.
revoke insert, update, delete, truncate, references, trigger
on table public.users
from public, anon, authenticated;

do $$
declare
  user_columns text;
begin
  select string_agg(pg_catalog.format('%I', columns.column_name), ', ' order by columns.ordinal_position)
  into user_columns
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'users';

  if user_columns is null then
    raise exception 'public.users does not exist or has no visible columns';
  end if;

  execute pg_catalog.format(
    'revoke insert (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
  execute pg_catalog.format(
    'revoke update (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
  execute pg_catalog.format(
    'revoke references (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
end
$$;

-- Replace all UPDATE-specific policies with one canonical own-row policy.
-- A restrictive policy also constrains any pre-existing FOR ALL policy.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policies.policyname
    from pg_catalog.pg_policies as policies
    where policies.schemaname = 'public'
      and policies.tablename = 'users'
      and policies.cmd = 'UPDATE'
  loop
    execute pg_catalog.format('drop policy %I on public.users', existing_policy.policyname);
  end loop;
end
$$;

drop policy if exists "users own row update" on public.users;
drop policy if exists "users update restricted to own row" on public.users;

create policy "users own row update"
on public.users
as permissive
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users update restricted to own row"
on public.users
as restrictive
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- The administrator check reads the protected users.is_admin column as its owner.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select users.is_admin from public.users as users where users.id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- All administrator flag changes must pass through this function. A global
-- transaction lock prevents two administrators from concurrently removing the
-- final two administrators and leaving the system without an administrator.
create or replace function public.set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  administrator_count bigint;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nobi:set_user_admin', 0)
  );

  -- Recheck after waiting for the lock in case the caller was demoted meanwhile.
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_is_admin is null then
    raise exception 'Target user and administrator state are required';
  end if;
  if not exists (select 1 from public.users as users where users.id = p_user_id) then
    raise exception 'Target user not found';
  end if;

  if p_is_admin = false
    and exists (
      select 1
      from public.users as users
      where users.id = p_user_id and users.is_admin = true
    )
  then
    select count(*)
    into administrator_count
    from public.users as users
    where users.is_admin = true;

    if administrator_count <= 1 then
      raise exception 'At least one administrator must remain' using errcode = '23514';
    end if;
  end if;

  update public.users as users
  set is_admin = p_is_admin
  where users.id = p_user_id;

  if not found then
    raise exception 'Target user not found';
  end if;
end;
$$;
revoke all on function public.set_user_admin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;

-- Refuse to commit if effective privileges still arrive through membership or PUBLIC.
do $$
begin
  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    cross join information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = 'users'
      and (
        pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'INSERT'
        )
        or pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'UPDATE'
        )
        or pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'REFERENCES'
        )
      )
  )
  then
    raise exception 'A public.users column write privilege is still reachable by a browser role';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    where pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'DELETE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRUNCATE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRIGGER')
  )
  then
    raise exception 'A dangerous public.users table privilege is still reachable by a browser role';
  end if;
end
$$;

commit;
