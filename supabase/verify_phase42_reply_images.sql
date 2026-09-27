-- Read-only post-deployment verification. The first column must be PASS before application rollout.
with
bucket_state as (
  select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'community'
),
storage_policies as (
  select policyname, cmd, permissive, roles, qual, with_check,
    pg_catalog.lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) as expression
  from pg_catalog.pg_policies
  where schemaname = 'storage' and tablename = 'objects'
),
expected_storage_policy_issues as (
  select 'OWNER_INSERT_POLICY'::text as code,
    'Owner INSERT policy is missing or does not bind bucket, prefix and userId directory'::text as detail
  where not exists (
    select 1 from storage_policies
    where policyname = 'community reply images owner insert'
      and cmd = 'INSERT' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(with_check, '') ~* 'bucket_id\s*=\s*''community'''
      and coalesce(with_check, '') ~* 'foldername\(name\).*\[1\].*''community-replies'''
      and coalesce(with_check, '') ~* 'foldername\(name\).*\[2\].*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(with_check, '')) !~ '\mor\M'
  )
  union all
  select 'OWNER_DELETE_POLICY',
    'Owner DELETE policy is missing or does not bind bucket, prefix and userId directory'
  where not exists (
    select 1 from storage_policies
    where policyname = 'community reply images owner delete'
      and cmd = 'DELETE' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(qual, '') ~* 'bucket_id\s*=\s*''community'''
      and coalesce(qual, '') ~* 'foldername\(name\).*\[1\].*''community-replies'''
      and coalesce(qual, '') ~* 'foldername\(name\).*\[2\].*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(qual, '')) !~ '\mor\M'
  )
),
storage_policy_drift as (
  select 'STORAGE_WRITE_POLICY_DRIFT'::text as code,
    pg_catalog.format(
      '%s [%s, permissive=%s, roles=%s] qual=%s with_check=%s',
      policyname, cmd, permissive, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
    ) as detail
  from storage_policies
  where cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and permissive = 'PERMISSIVE'
    and roles && array['public', 'anon', 'authenticated']::name[]
    and policyname not in ('community reply images owner insert', 'community reply images owner delete')
    and not (
      expression ~ 'bucket_id\s*=\s*''[a-z0-9_-]+''(::text)?'
      and expression !~ '''community'''
      and expression !~ '\mor\M'
    )
),
bucket_issues as (
  select 'BUCKET_MISSING'::text as code, 'community bucket does not exist'::text as detail
  where not exists (select 1 from bucket_state)
  union all
  select 'BUCKET_CONFIG',
    pg_catalog.format(
      'name=%s public=%s file_size_limit=%s allowed_mime_types=%s',
      name, public, file_size_limit, allowed_mime_types
    )
  from bucket_state
  where not (
    name = 'community'
    and public is true
    and file_size_limit = 5242880
    and coalesce(allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp'], false)
    and coalesce(allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp'], false)
  )
),
constraint_state as (
  select constraint_row.convalidated,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) as definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as class on class.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'posts'
    and constraint_row.conname = 'posts_reply_image_only_check'
    and constraint_row.contype = 'c'
),
constraint_issues as (
  select 'CONSTRAINT_MISSING'::text as code,
    'posts_reply_image_only_check does not exist'::text as detail
  where not exists (select 1 from constraint_state)
  union all
  select 'CONSTRAINT_NOT_VALIDATED', definition
  from constraint_state where not convalidated
  union all
  select 'CONSTRAINT_DEFINITION', definition
  from constraint_state
  where not (
    pg_catalog.lower(definition) like '%image_path is null%'
    and pg_catalog.lower(definition) like '%user_id is not null%'
    and pg_catalog.lower(definition) like '%parent_id is not null%'
    and pg_catalog.lower(definition) like '%community-replies/%'
    and pg_catalog.lower(definition) like '%user_id%'
    and pg_catalog.lower(definition) like '%jpg%png%webp%'
  )
),
invalid_image_rows as (
  select id
  from public.posts
  where image_path is not null
    and not (
      user_id is not null
      and parent_id is not null
      and image_path like 'community-replies/' || user_id::text || '/%'
      and image_path ~ '^community-replies/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
),
data_issues as (
  select 'INVALID_IMAGE_PATH_DATA'::text as code,
    pg_catalog.format('Noncompliant posts rows: %s', pg_catalog.string_agg(id::text, ', ' order by id)) as detail
  from invalid_image_rows
  having count(*) > 0
),
posts_relation as (
  select class.relrowsecurity, class.relforcerowsecurity
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'posts'
),
posts_rls_issues as (
  select 'POSTS_RLS'::text as code, 'public.posts RLS is disabled'::text as detail
  from posts_relation where not relrowsecurity
),
posts_policies as (
  select policyname, cmd, permissive, roles, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'posts'
),
owner_policy_issues as (
  select 'POSTS_OWNER_INSERT_POLICY'::text as code,
    'posts owner insert is missing or does not bind user_id to auth.uid()'::text as detail
  where not exists (
    select 1 from posts_policies
    where policyname = 'posts owner insert' and cmd = 'INSERT' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(with_check, '')) !~ '\mor\M'
  )
  union all
  select 'POSTS_OWNER_UPDATE_POLICY',
    'posts owner update is missing or does not bind USING and WITH CHECK to auth.uid()'
  where not exists (
    select 1 from posts_policies
    where policyname = 'posts owner update' and cmd = 'UPDATE' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(qual, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and coalesce(with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(qual, '')) !~ '\mor\M'
      and pg_catalog.lower(coalesce(with_check, '')) !~ '\mor\M'
  )
),
extra_posts_policy_issues as (
  select 'POSTS_WRITE_POLICY_DRIFT'::text as code,
    pg_catalog.format(
      '%s [%s, permissive=%s, roles=%s] qual=%s with_check=%s',
      policyname, cmd, permissive, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
    ) as detail
  from posts_policies
  where cmd in ('ALL', 'INSERT', 'UPDATE') and permissive = 'PERMISSIVE'
    and roles && array['public', 'anon', 'authenticated']::name[]
    and policyname not in ('posts owner insert', 'posts owner update')
),
table_grant_issues as (
  select 'POSTS_TABLE_GRANT'::text as code,
    pg_catalog.format('%s has table-level %s', grantee, privilege_type) as detail
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
column_grant_issues as (
  select 'POSTS_COLUMN_GRANT_DRIFT'::text as code,
    pg_catalog.format('%s.%s [%s]', grantee, column_name, privilege_type) as detail
  from column_grants
  where not (
    pg_catalog.lower(grantee) = 'authenticated'
    and (
      (privilege_type = 'INSERT' and column_name = any (
        array['user_id', 'content', 'nickname', 'avatar_url', 'title', 'category', 'parent_id', 'image_path']
      ))
      or (privilege_type = 'UPDATE' and column_name = any (
        array['content', 'nickname', 'avatar_url', 'title', 'category', 'image_path']
      ))
    )
  )
  union all
  select 'POSTS_INSERT_GRANTS_MISSING', 'authenticated INSERT column grants are incomplete'
  where (
    select count(distinct column_name) from column_grants
    where pg_catalog.lower(grantee) = 'authenticated' and privilege_type = 'INSERT'
      and column_name = any (array['user_id', 'content', 'nickname', 'avatar_url', 'title', 'category', 'parent_id', 'image_path'])
  ) <> 8
  union all
  select 'POSTS_UPDATE_GRANTS_MISSING', 'authenticated UPDATE column grants are incomplete'
  where (
    select count(distinct column_name) from column_grants
    where pg_catalog.lower(grantee) = 'authenticated' and privilege_type = 'UPDATE'
      and column_name = any (array['content', 'nickname', 'avatar_url', 'title', 'category', 'image_path'])
  ) <> 6
),
issues as (
  select * from bucket_issues
  union all select * from expected_storage_policy_issues
  union all select * from storage_policy_drift
  union all select * from constraint_issues
  union all select * from data_issues
  union all select * from posts_rls_issues
  union all select * from owner_policy_issues
  union all select * from extra_posts_policy_issues
  union all select * from table_grant_issues
  union all select * from column_grant_issues
)
select
  case when exists (select 1 from issues) then 'FAIL' else 'PASS' end as verification_status,
  coalesce((select jsonb_agg(to_jsonb(issue) order by issue.code, issue.detail) from issues as issue), '[]'::jsonb) as findings,
  coalesce((select jsonb_agg(to_jsonb(bucket)) from bucket_state as bucket), '[]'::jsonb) as bucket,
  coalesce((
    select jsonb_agg(to_jsonb(policy) order by policy.policyname)
    from storage_policies as policy
    where policy.expression like '%community%' or policy.policyname like 'community reply images%'
  ), '[]'::jsonb) as community_storage_policies,
  coalesce((select jsonb_agg(to_jsonb(state)) from constraint_state as state), '[]'::jsonb) as posts_constraint,
  coalesce((select jsonb_agg(to_jsonb(relation)) from posts_relation as relation), '[]'::jsonb) as posts_rls,
  coalesce((select jsonb_agg(to_jsonb(policy) order by policy.policyname) from posts_policies as policy), '[]'::jsonb) as posts_policies,
  coalesce((select jsonb_agg(to_jsonb(grant_row) order by grant_row.grantee, grant_row.privilege_type, grant_row.column_name) from column_grants as grant_row), '[]'::jsonb) as posts_client_column_grants;
