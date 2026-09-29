-- Phase 4.5.2 profiles UPDATE RLS verification. READ ONLY.
with update_policies as (
  select policyname, roles, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
), findings as (
  select 'PROFILES_SCHEMA_MISMATCH'::text as code
  where exists (
    select 1
    from (
      values
        ('id', 'uuid', 'NO'),
        ('created_at', 'timestamp with time zone', 'NO'),
        ('nickname', 'character varying', 'YES'),
        ('avatar_url', 'character varying', 'YES')
    ) as expected(column_name, data_type, is_nullable)
    left join information_schema.columns as actual
      on actual.table_schema = 'public'
      and actual.table_name = 'profiles'
      and actual.column_name = expected.column_name
    where actual.column_name is null
      or actual.data_type <> expected.data_type
      or actual.is_nullable <> expected.is_nullable
  )
  union all
  select 'PROFILES_RLS_DISABLED'::text as code
  where not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.profiles') and relrowsecurity
  )
  union all
  select 'UNSAFE_UPDATE_POLICY'
  where (select count(*) from update_policies) <> 1
    or not exists (
      select 1 from update_policies
      where policyname = 'profiles own update'
        and roles = array['authenticated']::name[]
        and qual = '(auth.uid() = id)'
        and with_check = '(auth.uid() = id)'
    )
  union all
  select 'PUBLIC_OR_ANON_CAN_UPDATE'
  where exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type = 'UPDATE'
    )
    or exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type = 'UPDATE'
    )
    or pg_catalog.has_table_privilege('anon', 'public.profiles', 'UPDATE')
    or pg_catalog.has_any_column_privilege('anon', 'public.profiles', 'UPDATE')
  union all
  select 'AUTHENTICATED_UPDATE_SCOPE'
  where pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    or not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE')
    or not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
)
select
  case when exists (select 1 from findings) then 'FAIL' else 'PASS' end as status,
  coalesce((select jsonb_agg(code order by code) from findings), '[]'::jsonb) as findings;

select policyname, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;
