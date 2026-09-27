-- Read-only Phase 4.2 reply-image preflight. Run as a database owner before the migration.
with
bucket_rows as (
  select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'community' or name = 'community'
),
bucket_issues as (
  select 'BUCKET_NAME_CONFLICT'::text as code,
    pg_catalog.format('Bucket name community is already used by id=%s', id) as detail
  from bucket_rows
  where name = 'community' and id <> 'community'
  union all
  select 'BUCKET_CONFIG_REVIEW',
    pg_catalog.format(
      'Existing bucket: name=%s public=%s file_size_limit=%s allowed_mime_types=%s',
      name, public, file_size_limit, allowed_mime_types
    )
  from bucket_rows
  where id = 'community'
    and not (
      name = 'community'
      and public is true
      and file_size_limit = 5242880
      and coalesce(allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp'], false)
      and coalesce(allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp'], false)
    )
),
storage_write_policies as (
  select policy.*,
    pg_catalog.lower(coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')) as expression
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'storage'
    and policy.tablename = 'objects'
    and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and policy.roles && array['public', 'anon', 'authenticated']::name[]
),
community_storage_policies as (
  select policyname, cmd, permissive, roles, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (
      policyname like 'community reply images%'
      or pg_catalog.lower(coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%community%'
    )
),
storage_policy_issues as (
  select 'STORAGE_POLICY_REVIEW'::text as code,
    pg_catalog.format(
      '%s [%s, permissive=%s, roles=%s] qual=%s with_check=%s',
      policyname, cmd, permissive, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
    ) as detail
  from storage_write_policies
  where permissive = 'PERMISSIVE'
    and policyname not in ('community reply images owner insert', 'community reply images owner delete')
    and not (
      expression ~ 'bucket_id\s*=\s*''[a-z0-9_-]+''(::text)?'
      and expression !~ '''community'''
      and expression !~ '\mor\M'
    )
),
posts_relation as (
  select class.relrowsecurity, class.relforcerowsecurity
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'posts'
),
posts_rls_issues as (
  select 'POSTS_MISSING'::text as code, 'public.posts does not exist'::text as detail
  where not exists (select 1 from posts_relation)
  union all
  select 'POSTS_RLS_DISABLED', 'public.posts.relrowsecurity is false'
  from posts_relation where not relrowsecurity
),
posts_owner_policy_issues as (
  select 'POSTS_OWNER_INSERT_POLICY'::text as code,
    'posts owner insert is missing or does not bind user_id to auth.uid()'::text as detail
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts owner insert'
      and cmd = 'INSERT' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(with_check, '')) !~ '\mor\M'
  )
  union all
  select 'POSTS_OWNER_UPDATE_POLICY',
    'posts owner update is missing or does not bind USING and WITH CHECK to auth.uid()'
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts owner update'
      and cmd = 'UPDATE' and permissive = 'PERMISSIVE'
      and roles && array['authenticated']::name[]
      and coalesce(qual, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and coalesce(with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(qual, '')) !~ '\mor\M'
      and pg_catalog.lower(coalesce(with_check, '')) !~ '\mor\M'
  )
),
extra_posts_write_policies as (
  select 'POSTS_WRITE_POLICY_REVIEW'::text as code,
    pg_catalog.format(
      '%s [%s, permissive=%s, roles=%s] qual=%s with_check=%s',
      policyname, cmd, permissive, roles::text, coalesce(qual, '<null>'), coalesce(with_check, '<null>')
    ) as detail
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'posts'
    and cmd in ('ALL', 'INSERT', 'UPDATE') and permissive = 'PERMISSIVE'
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
unexpected_column_grants as (
  select 'POSTS_COLUMN_GRANT'::text as code,
    pg_catalog.format('%s.%s [%s]', grantee, column_name, privilege_type) as detail
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'posts'
    and pg_catalog.lower(grantee) in ('public', 'anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE')
    and not (
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
),
image_column as (
  select data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'posts' and column_name = 'image_path'
),
image_column_issues as (
  select 'IMAGE_PATH_TYPE'::text as code,
    pg_catalog.format('Existing image_path type=%s nullable=%s', data_type, is_nullable) as detail
  from image_column
  where data_type <> 'text' or is_nullable <> 'YES'
),
invalid_image_rows as (
  select post.id
  from public.posts as post
  cross join lateral (select to_jsonb(post)->>'image_path' as image_path) as value
  where value.image_path is not null
    and not (
      post.user_id is not null
      and post.parent_id is not null
      and value.image_path like 'community-replies/' || post.user_id::text || '/%'
      and value.image_path ~ '^community-replies/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
),
invalid_data_issues as (
  select 'INVALID_IMAGE_PATH_DATA'::text as code,
    pg_catalog.format('Noncompliant posts rows: %s', pg_catalog.string_agg(id::text, ', ' order by id)) as detail
  from invalid_image_rows
  having count(*) > 0
),
issues as (
  select * from bucket_issues
  union all select * from storage_policy_issues
  union all select * from posts_rls_issues
  union all select * from posts_owner_policy_issues
  union all select * from extra_posts_write_policies
  union all select * from table_grant_issues
  union all select * from unexpected_column_grants
  union all select * from image_column_issues
  union all select * from invalid_data_issues
)
select
  case when exists (select 1 from issues) then 'BLOCKED / REVIEW REQUIRED' else 'SAFE TO MIGRATE' end as migration_status,
  coalesce((select jsonb_agg(to_jsonb(issue) order by issue.code, issue.detail) from issues as issue), '[]'::jsonb) as findings,
  coalesce((select jsonb_agg(to_jsonb(bucket)) from bucket_rows as bucket), '[]'::jsonb) as community_bucket,
  coalesce((select jsonb_agg(to_jsonb(policy) order by policy.policyname) from storage_write_policies as policy), '[]'::jsonb) as client_storage_write_policies,
  coalesce((select jsonb_agg(to_jsonb(policy) order by policy.policyname) from community_storage_policies as policy), '[]'::jsonb) as community_storage_policies,
  coalesce((select jsonb_agg(to_jsonb(column_row)) from image_column as column_row), '[]'::jsonb) as image_path_column,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', constraint_row.conname,
      'validated', constraint_row.convalidated,
      'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
    ))
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as class on class.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public' and class.relname = 'posts'
      and constraint_row.conname = 'posts_reply_image_only_check'
  ), '[]'::jsonb) as existing_reply_image_constraint,
  coalesce((select jsonb_agg(to_jsonb(relation)) from posts_relation as relation), '[]'::jsonb) as posts_rls_state,
  coalesce((
    select jsonb_agg(to_jsonb(policy) order by policy.policyname)
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public' and policy.tablename = 'posts'
  ), '[]'::jsonb) as posts_policies,
  coalesce((
    select jsonb_agg(to_jsonb(grant_row) order by grant_row.grantee, grant_row.privilege_type, grant_row.column_name)
    from information_schema.column_privileges as grant_row
    where grant_row.table_schema = 'public' and grant_row.table_name = 'posts'
      and pg_catalog.lower(grant_row.grantee) in ('public', 'anon', 'authenticated')
      and grant_row.privilege_type in ('INSERT', 'UPDATE')
  ), '[]'::jsonb) as posts_client_column_grants;
