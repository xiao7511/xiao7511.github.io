-- Read-only inventory and deployment gate for the posts security baseline.
with
posts_relation as (
  select class.relrowsecurity, class.relforcerowsecurity
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'posts'
),
posts_table_grants as (
  select grantee, privilege_type
  from information_schema.table_privileges
  where table_schema = 'public' and table_name = 'posts'
    and pg_catalog.lower(grantee) in ('public', 'anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE')
),
posts_column_grants as (
  select grantee, column_name, privilege_type
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'posts'
    and pg_catalog.lower(grantee) in ('public', 'anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE')
),
posts_policies as (
  select policyname, cmd, permissive, roles, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'posts'
),
like_rpc as (
  select procedure.oid,
    procedure.prosecdef as security_definer,
    pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure('public.toggle_post_like(bigint,boolean)')
),
moderation_rpc as (
  select procedure.oid,
    procedure.prosecdef as security_definer,
    pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure('public.review_post_report(bigint,text,text)')
),
post_likes_relation as (
  select class.relrowsecurity
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'post_likes'
),
likes_users_column as (
  select attribute.attrelid, attribute.attnum
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = pg_catalog.to_regclass('public.posts')
    and attribute.attname = 'likes_users'
    and not attribute.attisdropped
),
likes_users_dependencies as (
  select
    pg_catalog.pg_describe_object(dependency.classid, dependency.objid, dependency.objsubid) as dependent_object,
    dependency.deptype
  from pg_catalog.pg_depend as dependency
  join likes_users_column as likes_column
    on dependency.refobjid = likes_column.attrelid
   and dependency.refobjsubid = likes_column.attnum
  where dependency.deptype in ('n', 'a')
),
blocking_issues as (
  select 'POSTS_MISSING'::text as code, 'public.posts does not exist'::text as detail
  where not exists (select 1 from posts_relation)
  union all
  select 'POST_LIKES_MISSING', 'public.post_likes does not exist'
  where not exists (select 1 from post_likes_relation)
  union all
  select 'POST_LIKES_RLS_DISABLED', 'public.post_likes RLS must be enabled before relying on the normalized fallback path'
  where exists (select 1 from post_likes_relation where not relrowsecurity)
  union all
  select 'LIKE_RPC_MISSING_OR_UNSAFE', 'toggle_post_like must exist as SECURITY DEFINER and be executable only by authenticated clients'
  where not exists (
    select 1 from like_rpc
    where security_definer and authenticated_execute and not anon_execute
  )
  union all
  select 'MODERATION_RPC_MISSING_OR_UNSAFE', 'review_post_report must exist as SECURITY DEFINER and remain executable by authenticated clients'
  where not exists (
    select 1 from moderation_rpc where security_definer and authenticated_execute and not anon_execute
  )
),
observations as (
  select 'POSTS_RLS_DISABLED'::text as code, 'The migration will enable public.posts RLS'::text as detail
  where exists (select 1 from posts_relation where not relrowsecurity)
  union all
  select 'POSTS_TABLE_GRANT', pg_catalog.format('%s has table-level %s', grantee, privilege_type)
  from posts_table_grants
  union all
  select 'POSTS_COLUMN_GRANT', pg_catalog.format('%s.%s [%s]', grantee, column_name, privilege_type)
  from posts_column_grants
  union all
  select 'POSTS_CLIENT_WRITE_POLICY', pg_catalog.format(
    '%s [%s, permissive=%s, roles=%s] qual=%s with_check=%s',
    policyname, cmd, permissive, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
  )
  from posts_policies
  where cmd in ('ALL', 'INSERT', 'UPDATE')
    and roles && array['public', 'anon', 'authenticated']::name[]
  union all
  select 'LIKES_USERS_DEPENDENCY', dependent_object || ' [deptype=' || deptype::text || ']'
  from likes_users_dependencies
)
select
  case when exists (select 1 from blocking_issues)
    then 'BLOCKED / REVIEW REQUIRED'
    else 'SAFE TO APPLY POSTS SECURITY BASELINE'
  end as migration_status,
  coalesce((select jsonb_agg(to_jsonb(issue) order by issue.code, issue.detail) from blocking_issues as issue), '[]'::jsonb) as blockers,
  coalesce((select jsonb_agg(to_jsonb(item) order by item.code, item.detail) from observations as item), '[]'::jsonb) as current_security_findings,
  coalesce((select jsonb_agg(to_jsonb(relation)) from posts_relation as relation), '[]'::jsonb) as posts_rls,
  coalesce((select jsonb_agg(to_jsonb(policy) order by policy.policyname) from posts_policies as policy), '[]'::jsonb) as posts_policies,
  coalesce((select jsonb_agg(to_jsonb(rpc)) from like_rpc as rpc), '[]'::jsonb) as like_rpc,
  coalesce((select jsonb_agg(to_jsonb(relation)) from post_likes_relation as relation), '[]'::jsonb) as post_likes,
  coalesce((select jsonb_agg(to_jsonb(rpc)) from moderation_rpc as rpc), '[]'::jsonb) as moderation_rpc;
