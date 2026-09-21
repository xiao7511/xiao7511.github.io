-- NOBI V2 production preflight.
-- READ ONLY: run manually as a database administrator and return every result set for review.

-- 1. Confirm RLS state for every table involved in authorization or foreign keys.
select
  namespace.nspname as schema_name,
  class.relname as table_name,
  class.relrowsecurity as rls_enabled,
  class.relforcerowsecurity as force_rls
from pg_catalog.pg_class as class
join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relname in ('users', 'profiles', 'posts', 'post_likes', 'content_management', 'site_config')
order by class.relname;

-- 2. Inspect every current users policy. Ordinary users must not be able to promote themselves.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('users', 'site_config')
order by tablename, policyname;

-- 3. Inspect anon/authenticated table privileges on users.
select
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'users'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 4. Inspect column privileges on the administrator flag.
select
  grantee,
  privilege_type,
  is_grantable
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and column_name = 'is_admin'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Effective privileges include privileges inherited through role membership or table-level grants.
select
  role_name,
  pg_catalog.has_table_privilege(role_name, 'public.users', 'UPDATE') as can_update_users,
  pg_catalog.has_column_privilege(role_name, 'public.users', 'is_admin', 'UPDATE') as can_update_is_admin
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- 5-7. Confirm the exact types and primary/unique constraints required by the migration.
select
  namespace.nspname as schema_name,
  class.relname as table_name,
  attribute.attname as column_name,
  pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as data_type,
  constraint_row.conname as constraint_name,
  constraint_row.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_row.oid) as constraint_definition
from pg_catalog.pg_constraint as constraint_row
join pg_catalog.pg_class as class on class.oid = constraint_row.conrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
join pg_catalog.pg_attribute as attribute
  on attribute.attrelid = class.oid
  and attribute.attnum = any(constraint_row.conkey)
where namespace.nspname = 'public'
  and (
    (class.relname = 'users' and attribute.attname = 'id')
    or (class.relname = 'content_management' and attribute.attname = 'id')
    or (class.relname = 'site_config' and attribute.attname = 'section')
  )
  and constraint_row.contype in ('p', 'u')
  and pg_catalog.array_length(constraint_row.conkey, 1) = 1
order by class.relname, constraint_row.contype, constraint_row.conname;

-- Standalone unique indexes are also valid uniqueness providers for these single columns.
select
  namespace.nspname as schema_name,
  class.relname as table_name,
  attribute.attname as column_name,
  index_class.relname as index_name,
  pg_catalog.pg_get_indexdef(index_row.indexrelid) as index_definition
from pg_catalog.pg_index as index_row
join pg_catalog.pg_class as class on class.oid = index_row.indrelid
join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
join pg_catalog.pg_attribute as attribute
  on attribute.attrelid = class.oid
  and index_row.indkey[0] = attribute.attnum
where namespace.nspname = 'public'
  and index_row.indisunique
  and index_row.indnkeyatts = 1
  and index_row.indpred is null
  and index_row.indexprs is null
  and (
    (class.relname = 'users' and attribute.attname = 'id')
    or (class.relname = 'content_management' and attribute.attname = 'id')
    or (class.relname = 'site_config' and attribute.attname = 'section')
  )
order by class.relname, index_class.relname;

-- Confirm the base column types used by image target validation and post likes.
select
  table_name,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'users' and column_name in ('id', 'is_admin'))
    or (table_name = 'posts' and column_name in ('id', 'parent_id'))
    or (table_name = 'post_likes' and column_name in ('post_id', 'user_id'))
    or (table_name = 'content_management' and column_name in ('id', 'category', 'cover_url', 'detail_urls'))
    or (table_name = 'site_config' and column_name in ('section', 'url', 'updated_at'))
  )
order by table_name, ordinal_position;

-- 8. A non-empty result means UNIQUE(section) cannot be safely added without data cleanup.
select
  section,
  count(*) as duplicate_count
from public.site_config
group by section
having count(*) > 1
order by duplicate_count desc, section;

-- 9. Inspect owners and security settings of related current functions.
select
  namespace.nspname as schema_name,
  procedure.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_settings,
  pg_catalog.array_to_string(procedure.proacl, ',') as access_control_list
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'is_admin',
    'record_page_view',
    'nobi_storage_image_key',
    'get_image_like_summary',
    'toggle_image_like',
    'get_admin_dashboard_stats'
  )
order by procedure.proname, identity_arguments;

-- 10. Inspect equivalent indexes before the migration adds a user_id-leading post_likes index.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in ('post_likes', 'site_config', 'content_management', 'users')
order by tablename, indexname;
