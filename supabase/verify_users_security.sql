-- Verification for 202609210000_secure_users_admin_privilege.sql.
-- READ ONLY: run after the security migration and return every result set for review.

-- Expected: false for both roles and both effective UPDATE checks.
select
  role_name,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'UPDATE') as can_update_users,
  pg_catalog.has_column_privilege(role_name, 'public.users', 'is_admin', 'UPDATE') as can_update_is_admin
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Expected: every boolean is false. SELECT is intentionally not changed by this migration.
select
  role_name,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'INSERT') as can_insert_users,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'DELETE') as can_delete_users,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'TRUNCATE') as can_truncate_users,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'REFERENCES') as can_reference_users,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'TRIGGER') as can_create_users_trigger
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Expected: every effective column privilege boolean is false.
select
  roles.role_name,
  columns.column_name,
  pg_catalog.has_column_privilege(
    roles.role_name,
    'public.users',
    columns.column_name,
    'INSERT'
  ) as can_insert_column,
  pg_catalog.has_column_privilege(
    roles.role_name,
    'public.users',
    columns.column_name,
    'UPDATE'
  ) as can_update_column,
  pg_catalog.has_column_privilege(
    roles.role_name,
    'public.users',
    columns.column_name,
    'REFERENCES'
  ) as can_reference_column
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name = 'users'
order by roles.role_name, columns.ordinal_position;

-- Expected: no explicit INSERT or UPDATE grant remains for browser roles or PUBLIC.
select
  grantee,
  column_name,
  privilege_type,
  is_grantable
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE')
order by grantee, column_name, privilege_type;

-- Expected: RLS enabled, with own-row USING and WITH CHECK on UPDATE policies.
select
  class.relrowsecurity as rls_enabled,
  class.relforcerowsecurity as force_rls
from pg_catalog.pg_class as class
where class.oid = 'public.users'::regclass;

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'users'
order by cmd, policyname;

-- Expected: authenticated=true and anon=false for set_user_admin EXECUTE.
select
  role_name,
  pg_catalog.has_function_privilege(
    role_name,
    'public.set_user_admin(uuid,boolean)',
    'EXECUTE'
  ) as can_execute_set_user_admin
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Expected: both functions are SECURITY DEFINER, owned by the trusted migration owner,
-- have a fixed search_path, and have no PUBLIC/anon EXECUTE grant.
select
  procedure.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_settings,
  pg_catalog.array_to_string(procedure.proacl, ',') as access_control_list
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in ('is_admin', 'set_user_admin')
order by procedure.proname, identity_arguments;

-- Registration audit: inspect how auth.users creates or synchronizes public.users rows.
-- Review trigger owner and definition before applying the security migration.
select
  source_namespace.nspname as source_schema,
  source_table.relname as source_table,
  trigger_row.tgname as trigger_name,
  function_namespace.nspname as function_schema,
  function_row.proname as function_name,
  pg_catalog.pg_get_userbyid(function_row.proowner) as function_owner,
  function_row.prosecdef as security_definer,
  pg_catalog.pg_get_triggerdef(trigger_row.oid) as trigger_definition
from pg_catalog.pg_trigger as trigger_row
join pg_catalog.pg_class as source_table on source_table.oid = trigger_row.tgrelid
join pg_catalog.pg_namespace as source_namespace on source_namespace.oid = source_table.relnamespace
join pg_catalog.pg_proc as function_row on function_row.oid = trigger_row.tgfoid
join pg_catalog.pg_namespace as function_namespace on function_namespace.oid = function_row.pronamespace
where not trigger_row.tgisinternal
  and (
    (source_namespace.nspname = 'auth' and source_table.relname = 'users')
    or (source_namespace.nspname = 'public' and source_table.relname = 'users')
  )
order by source_schema, source_table, trigger_name;

-- Personal profile editing remains on public.profiles, not public.users.
select
  grantee,
  column_name,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;
