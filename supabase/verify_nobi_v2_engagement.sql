-- Read-only verification for 202609210001_nobi_v2_engagement.sql.
-- Run immediately after the migration and return every result set for review.

-- Expected: the verified users-security prerequisite remains postgres-owned,
-- SECURITY DEFINER, search_path=pg_catalog, anon=false, authenticated=true.
select
  pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_settings,
  pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    as authenticated_execute
from pg_catalog.pg_proc as procedure
where procedure.oid = 'public.is_admin()'::regprocedure;

-- Expected page_views columns: id bigint identity; session_id/visitor_id uuid;
-- page_path text; viewed_at timestamptz; viewed_on date; all NOT NULL.
-- Expected image_likes columns are the eight reviewed columns from the migration.
select
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default,
  columns.is_identity
from information_schema.columns as columns
where columns.table_schema = 'public'
  and columns.table_name in ('page_views', 'image_likes')
order by columns.table_name, columns.ordinal_position;

-- Expected: rls_enabled=true for both tables.
select
  class.relname as table_name,
  class.relrowsecurity as rls_enabled,
  class.relforcerowsecurity as force_rls
from pg_catalog.pg_class as class
where class.oid in ('public.page_views'::regclass, 'public.image_likes'::regclass)
order by class.relname;

-- Expected: every mutation boolean is false for both roles and tables.
select
  roles.role_name,
  tables.table_name,
  pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'INSERT')
    as can_insert_table,
  pg_catalog.has_any_column_privilege(roles.role_name, tables.table_name, 'INSERT')
    as can_insert_any_column,
  pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'UPDATE')
    as can_update_table,
  pg_catalog.has_any_column_privilege(roles.role_name, tables.table_name, 'UPDATE')
    as can_update_any_column,
  pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'DELETE')
    as can_delete,
  pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'TRUNCATE')
    as can_truncate,
  pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'TRIGGER')
    as can_create_trigger
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('public.page_views'), ('public.image_likes')) as tables(table_name)
order by tables.table_name, roles.role_name;

-- Expected RPC EXECUTE matrix:
-- record_page_view             anon=true,  authenticated=true
-- get_image_like_summary       anon=true,  authenticated=true
-- toggle_image_like            anon=true,  authenticated=true
-- get_admin_dashboard_stats    anon=false, authenticated=true
-- nobi_storage_image_key       anon=false, authenticated=false
select
  functions.function_name,
  roles.role_name,
  pg_catalog.has_function_privilege(
    roles.role_name,
    functions.function_signature,
    'EXECUTE'
  ) as can_execute
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (
  values
    ('record_page_view', 'public.record_page_view(uuid,uuid,text)'),
    ('get_image_like_summary', 'public.get_image_like_summary(text[],uuid)'),
    ('toggle_image_like', 'public.toggle_image_like(uuid,text,integer,text,uuid)'),
    ('get_admin_dashboard_stats', 'public.get_admin_dashboard_stats()'),
    ('nobi_storage_image_key', 'public.nobi_storage_image_key(text)')
) as functions(function_name, function_signature)
order by functions.function_name, roles.role_name;

-- Expected: owner=postgres and search_path=pg_catalog for every function.
-- The four RPCs are SECURITY DEFINER; nobi_storage_image_key is not.
select
  procedure.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
  procedure.prosecdef as security_definer,
  procedure.provolatile as volatility,
  procedure.proconfig as function_settings,
  pg_catalog.array_to_string(procedure.proacl, ',') as access_control_list
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'record_page_view',
    'get_image_like_summary',
    'toggle_image_like',
    'get_admin_dashboard_stats',
    'nobi_storage_image_key'
  )
order by procedure.proname, identity_arguments;

-- Review all RLS policies. Expected: only authenticated administrator SELECT
-- policies; browser writes occur solely through controlled RPCs.
select
  policies.tablename,
  policies.policyname,
  policies.permissive,
  policies.roles,
  policies.cmd,
  policies.qual,
  policies.with_check
from pg_catalog.pg_policies as policies
where policies.schemaname = 'public'
  and policies.tablename in ('page_views', 'image_likes')
order by policies.tablename, policies.cmd, policies.policyname;

-- Expected indexes include all page-view lookup/trend indexes, both partial
-- image actor uniqueness indexes, and the image lookup/context/time indexes.
select
  table_class.relname as table_name,
  index_class.relname as index_name,
  index_row.indisunique as is_unique,
  pg_catalog.pg_get_indexdef(index_row.indexrelid) as index_definition,
  pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
from pg_catalog.pg_index as index_row
join pg_catalog.pg_class as table_class on table_class.oid = index_row.indrelid
join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
where index_row.indrelid in ('public.page_views'::regclass, 'public.image_likes'::regclass)
order by table_class.relname, index_class.relname;

-- Expected constraints include page path validation; image key/kind/index/actor
-- checks; content_id -> content_management(id) ON DELETE CASCADE; and
-- user_id -> auth.users(id) ON DELETE CASCADE.
select
  class.relname as table_name,
  constraint_row.conname as constraint_name,
  constraint_row.contype as constraint_type,
  referenced_namespace.nspname as referenced_schema,
  referenced_class.relname as referenced_table,
  constraint_row.confdeltype as foreign_key_delete_action,
  pg_catalog.pg_get_constraintdef(constraint_row.oid, true) as constraint_definition
from pg_catalog.pg_constraint as constraint_row
join pg_catalog.pg_class as class on class.oid = constraint_row.conrelid
left join pg_catalog.pg_class as referenced_class on referenced_class.oid = constraint_row.confrelid
left join pg_catalog.pg_namespace as referenced_namespace
  on referenced_namespace.oid = referenced_class.relnamespace
where constraint_row.conrelid in ('public.page_views'::regclass, 'public.image_likes'::regclass)
order by class.relname, constraint_row.conname;

-- Expected: one user_id-leading single-column plain index, whether pre-existing
-- or created by this migration. No redundant post_id index is required.
select
  index_class.relname as index_name,
  index_row.indisunique as is_unique,
  pg_catalog.pg_get_indexdef(index_row.indexrelid) as index_definition
from pg_catalog.pg_index as index_row
join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
join pg_catalog.pg_attribute as attribute
  on attribute.attrelid = index_row.indrelid
  and index_row.indkey[0] = attribute.attnum
where index_row.indrelid = 'public.post_likes'::regclass
  and attribute.attname = 'user_id'
  and index_row.indpred is null
  and index_row.indexprs is null
  and index_row.indnkeyatts = 1
order by index_class.relname;

-- Return the effective feature switch without modifying an existing operator value.
-- Review that there is exactly one row and that its value matches current intent.
select section, url
from public.site_config
where section = 'features_v2';
