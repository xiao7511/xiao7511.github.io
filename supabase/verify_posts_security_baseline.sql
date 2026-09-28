-- Read-only verification for the production posts security baseline.
with
posts_relation as (
  select class.relrowsecurity, class.relforcerowsecurity
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'posts'
),
table_grants as (
  select grantee, privilege_type
  from information_schema.table_privileges
  where table_schema = 'public' and table_name = 'posts'
    and pg_catalog.lower(grantee) in ('public', 'anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE')
),
column_grants as (
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
issues as (
  select 'POSTS_RLS'::text as code, 'public.posts RLS is not enabled'::text as detail
  where not exists (select 1 from posts_relation where relrowsecurity)
  union all
  select 'POSTS_FORCE_RLS', 'public.posts FORCE RLS would prevent the table-owner moderation RPC bypass'
  where exists (select 1 from posts_relation where relforcerowsecurity)
  union all
  select 'CLIENT_TABLE_GRANT', pg_catalog.format('%s has table-level %s', grantee, privilege_type)
  from table_grants
  union all
  select 'ANON_COLUMN_GRANT', pg_catalog.format('%s.%s [%s]', grantee, column_name, privilege_type)
  from column_grants
  where pg_catalog.lower(grantee) in ('public', 'anon')
  union all
  select 'AUTHENTICATED_COLUMN_GRANT', pg_catalog.format('%s.%s [%s]', grantee, column_name, privilege_type)
  from column_grants
  where pg_catalog.lower(grantee) = 'authenticated'
    and not (
      (privilege_type = 'INSERT' and column_name = any (array['user_id', 'content', 'nickname', 'avatar_url', 'title', 'category', 'parent_id', 'image_path']))
      or
      (privilege_type = 'UPDATE' and column_name = any (array['content', 'nickname', 'avatar_url', 'title', 'category', 'image_path']))
    )
  union all
  select 'AUTHENTICATED_INSERT_GRANTS', 'authenticated INSERT column grants are incomplete'
  where (
    select count(distinct column_name) from column_grants
    where pg_catalog.lower(grantee) = 'authenticated'
      and privilege_type = 'INSERT'
      and column_name = any (array['user_id', 'content', 'nickname', 'avatar_url', 'title', 'category', 'parent_id', 'image_path'])
  ) <> 7 + case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'image_path'
  ) then 1 else 0 end
  union all
  select 'AUTHENTICATED_UPDATE_GRANTS', 'authenticated UPDATE column grants are incomplete'
  where (
    select count(distinct column_name) from column_grants
    where pg_catalog.lower(grantee) = 'authenticated'
      and privilege_type = 'UPDATE'
      and column_name = any (array['content', 'nickname', 'avatar_url', 'title', 'category', 'image_path'])
  ) <> 5 + case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'image_path'
  ) then 1 else 0 end
  union all
  select 'OWNER_INSERT_POLICY', 'posts owner insert is missing or does not bind user_id to auth.uid()'
  where not exists (
    select 1 from posts_policies
    where policyname = 'posts owner insert'
      and cmd = 'INSERT' and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and coalesce(with_check, '') ~* '^\(?\s*user_id\s*=\s*auth\.uid\(\)\s*\)?$'
  )
  union all
  select 'OWNER_UPDATE_POLICY', 'posts owner update is missing or does not bind USING and WITH CHECK to auth.uid()'
  where not exists (
    select 1 from posts_policies
    where policyname = 'posts owner update'
      and cmd = 'UPDATE' and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and coalesce(qual, '') ~* '^\(?\s*user_id\s*=\s*auth\.uid\(\)\s*\)?$'
      and coalesce(with_check, '') ~* '^\(?\s*user_id\s*=\s*auth\.uid\(\)\s*\)?$'
  )
  union all
  select 'EXTRA_PERMISSIVE_WRITE_POLICY', pg_catalog.format(
    '%s [%s, roles=%s] qual=%s with_check=%s',
    policyname, cmd, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
  )
  from posts_policies
  where permissive = 'PERMISSIVE'
    and cmd in ('ALL', 'INSERT', 'UPDATE')
    and roles && array['public', 'anon', 'authenticated']::name[]
    and policyname not in ('posts owner insert', 'posts owner update')
),
compatibility_issues as (
  select 'LIKE_RPC'::text as code, 'toggle_post_like SECURITY DEFINER RPC or execute grants are unsafe'::text as detail
  where pg_catalog.to_regprocedure('public.toggle_post_like(bigint,boolean)') is null
    or not coalesce((
      select procedure.prosecdef
        and pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
      from pg_catalog.pg_proc as procedure
      where procedure.oid = pg_catalog.to_regprocedure('public.toggle_post_like(bigint,boolean)')
    ), false)
  union all
  select 'POST_LIKES_RLS', 'public.post_likes is missing or RLS is disabled'
  where not exists (
    select 1
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public' and class.relname = 'post_likes' and class.relrowsecurity
  )
  union all
  select 'MODERATION_RPC', 'review_post_report SECURITY DEFINER RPC or authenticated execute grant is unavailable'
  where pg_catalog.to_regprocedure('public.review_post_report(bigint,text,text)') is null
    or not coalesce((
      select procedure.prosecdef
        and pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
      from pg_catalog.pg_proc as procedure
      where procedure.oid = pg_catalog.to_regprocedure('public.review_post_report(bigint,text,text)')
    ), false)
),
all_issues as (
  select * from issues
  union all select * from compatibility_issues
)
select
  case when exists (select 1 from all_issues) then 'FAIL' else 'PASS' end as verification_status,
  coalesce((select jsonb_agg(to_jsonb(issue) order by issue.code, issue.detail) from all_issues as issue), '[]'::jsonb) as findings,
  coalesce((select jsonb_agg(to_jsonb(relation)) from posts_relation as relation), '[]'::jsonb) as posts_rls,
  coalesce((select jsonb_agg(to_jsonb(policy) order by policy.policyname) from posts_policies as policy), '[]'::jsonb) as posts_policies,
  coalesce((select jsonb_agg(to_jsonb(grant_row) order by grant_row.grantee, grant_row.privilege_type, grant_row.column_name) from column_grants as grant_row), '[]'::jsonb) as posts_client_column_grants;
