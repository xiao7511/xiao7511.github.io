-- Phase 4.5 avatar Storage preflight. READ ONLY.
with avatar_bucket as (
  select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'avatars'
),
avatar_policies as (
  select policyname, permissive, roles, cmd, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (coalesce(qual, '') ilike '%avatars%' or coalesce(with_check, '') ilike '%avatars%')
),
profile_owner_update as (
  select policyname, roles, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and cmd = 'UPDATE'
    and roles @> array['authenticated']::name[]
    and coalesce(qual, '') ilike '%id%auth.uid()%'
    and coalesce(with_check, '') ilike '%id%auth.uid()%'
),
issues as (
  select 'AVATAR_BUCKET_CONFIG', format('public=%s size=%s mime=%s', public, file_size_limit, allowed_mime_types)
  from avatar_bucket
  where public is distinct from true
    or file_size_limit is distinct from 5242880
    or allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp']::text[]
  union all
  select 'AVATAR_WRITE_POLICY_REVIEW', format('%s [%s roles=%s] qual=%s with_check=%s', policyname, cmd, roles, qual, with_check)
  from avatar_policies
  where cmd in ('INSERT', 'UPDATE', 'DELETE')
    and policyname not in ('avatar owner insert', 'avatar owner update', 'avatar owner delete')
  union all
  select 'PROFILE_OWNER_UPDATE_POLICY', 'profiles must have an authenticated UPDATE policy binding id to auth.uid()'
  where not exists (select 1 from profile_owner_update)
)
select
  case when exists (select 1 from issues) then 'BLOCKED / REVIEW REQUIRED' else 'SAFE TO MIGRATE' end as migration_readiness,
  coalesce((select jsonb_agg(to_jsonb(issue)) from issues as issue), '[]'::jsonb) as findings,
  coalesce((select jsonb_agg(to_jsonb(bucket)) from avatar_bucket as bucket), '[]'::jsonb) as bucket,
  case when exists (select 1 from avatar_bucket) then 'REUSE EXISTING BUCKET' else 'MIGRATION WILL CREATE BUCKET' end as bucket_action,
  coalesce((select jsonb_agg(to_jsonb(policy)) from avatar_policies as policy), '[]'::jsonb) as policies;

select
  class.relrowsecurity as profiles_rls,
  pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE') as authenticated_avatar_update,
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.with_check
from pg_catalog.pg_class as class
join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
left join pg_catalog.pg_policies as policy on policy.schemaname = namespace.nspname and policy.tablename = class.relname
where namespace.nspname = 'public' and class.relname = 'profiles'
order by policy.cmd, policy.policyname;
