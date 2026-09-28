-- Phase 4.5 avatar Storage verification. READ ONLY.
with bucket_issues as (
  select 'BUCKET_CONFIG'::text as code
  where not exists (
    select 1 from storage.buckets
    where id = 'avatars'
      and name = 'avatars'
      and public is true
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  )
),
policy_issues as (
  select 'OWNER_INSERT'::text as code
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatar owner insert' and cmd = 'INSERT' and roles @> array['authenticated']::name[]
      and coalesce(with_check, '') ilike '%bucket_id = ''avatars''%'
      and coalesce(with_check, '') ilike '%storage.foldername(name)%auth.uid()%'
  )
  union all
  select 'OWNER_UPDATE'
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatar owner update' and cmd = 'UPDATE' and roles @> array['authenticated']::name[]
      and coalesce(qual, '') ilike '%bucket_id = ''avatars''%'
      and coalesce(qual, '') ilike '%storage.foldername(name)%auth.uid()%'
      and coalesce(with_check, '') ilike '%bucket_id = ''avatars''%'
      and coalesce(with_check, '') ilike '%storage.foldername(name)%auth.uid()%'
  )
  union all
  select 'OWNER_DELETE'
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatar owner delete' and cmd = 'DELETE' and roles @> array['authenticated']::name[]
      and coalesce(qual, '') ilike '%bucket_id = ''avatars''%'
      and coalesce(qual, '') ilike '%storage.foldername(name)%auth.uid()%'
  )
  union all
  select 'UNEXPECTED_WRITE_POLICY:' || policyname
  from pg_catalog.pg_policies
  where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and (coalesce(qual, '') ilike '%avatars%' or coalesce(with_check, '') ilike '%avatars%')
    and policyname not in ('avatar owner insert', 'avatar owner update', 'avatar owner delete')
),
profile_issues as (
  select 'PROFILES_RLS'::text as code
  where not exists (
    select 1 from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public' and class.relname = 'profiles' and class.relrowsecurity
  )
  union all
  select 'PROFILE_AVATAR_GRANT'
  where not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
  union all
  select 'PROFILE_OWNER_UPDATE_POLICY'
  where not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
      and coalesce(qual, '') ilike '%id%auth.uid()%'
      and coalesce(with_check, '') ilike '%id%auth.uid()%'
  )
)
select
  case when exists (select 1 from bucket_issues union all select * from policy_issues union all select * from profile_issues)
    then 'FAIL' else 'PASS' end as verification,
  coalesce(
    (select jsonb_agg(to_jsonb(issue)) from (
      select * from bucket_issues union all select * from policy_issues union all select * from profile_issues
    ) as issue),
    '[]'::jsonb
  ) as findings;
