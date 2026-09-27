-- Read-only checks to run before the Phase 4 trust/safety migration.
select pg_class.relname, pg_class.relrowsecurity
from pg_catalog.pg_class
join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relname in ('posts', 'profiles', 'post_likes')
order by pg_class.relname;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'posts' and column_name in ('id', 'user_id', 'parent_id', 'content', 'nickname', 'avatar_url', 'title', 'category'))
    or (table_name = 'profiles' and column_name in ('id', 'is_admin'))
  )
order by table_name, ordinal_position;

select pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure);

select
  pg_catalog.has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') as anon_can_execute,
  pg_catalog.has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') as authenticated_can_execute;

select
  information_schema.table_constraints.constraint_name,
  information_schema.table_constraints.table_name,
  pg_catalog.pg_get_constraintdef(pg_constraint.oid) as definition
from information_schema.table_constraints
join pg_catalog.pg_namespace
  on pg_namespace.nspname = information_schema.table_constraints.table_schema
join pg_catalog.pg_class
  on pg_class.relnamespace = pg_namespace.oid
  and pg_class.relname = information_schema.table_constraints.table_name
join pg_catalog.pg_constraint
  on pg_constraint.conrelid = pg_class.oid
  and pg_constraint.conname = information_schema.table_constraints.constraint_name
where table_schema = 'public'
  and table_name in ('posts', 'profiles', 'post_likes')
  and constraint_type = 'FOREIGN KEY'
order by table_name, constraint_name;
