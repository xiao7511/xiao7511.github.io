-- Phase 4.6.1A-5B unified profile provisioning verification. READ ONLY.
with function_state as (
  select
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
    pg_catalog.pg_get_functiondef(procedure.oid) as definition
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure('public.handle_new_user()')
), trigger_state as (
  select
    trigger_row.tgfoid,
    trigger_row.tgenabled,
    pg_catalog.pg_get_triggerdef(trigger_row.oid) as definition
  from pg_catalog.pg_trigger as trigger_row
  where trigger_row.tgrelid = pg_catalog.to_regclass('auth.users')
    and trigger_row.tgname = 'on_auth_user_created'
    and not trigger_row.tgisinternal
), profile_columns as (
  select array_agg(columns.column_name::text order by columns.column_name::text) as names
  from information_schema.columns as columns
  where columns.table_schema::text = 'public' and columns.table_name::text = 'profiles'
), findings as (
  select 'HANDLE_NEW_USER_MISSING'::text as code
  where not exists (select 1 from function_state)
  union all
  select 'HANDLE_NEW_USER_SECURITY_CONFIGURATION'
  where not exists (
    select 1 from function_state
    where prosecdef
      and proconfig = array['search_path=pg_catalog']
      and owner_name = 'postgres'
  )
  union all
  select 'HANDLE_NEW_USER_PROFILE_PROVISIONING'
  where not exists (
    select 1 from function_state
    where definition ilike '%insert into game.profiles (id, email)%'
      and definition ilike '%insert into public.users (id, email, is_admin)%'
      and definition ilike '%insert into public.profiles (id)%'
      and definition ilike '%on conflict (id) do nothing%'
  )
  union all
  select 'AUTH_USER_TRIGGER_MISSING'
  where not exists (select 1 from trigger_state)
  union all
  select 'AUTH_USER_TRIGGER_WRONG_FUNCTION'
  where not exists (
    select 1 from trigger_state
    where tgfoid = pg_catalog.to_regprocedure('public.handle_new_user()')
      and tgenabled <> 'D'
      and definition ilike '%AFTER INSERT%'
  )
  union all
  select 'PROFILES_SCHEMA_MISMATCH'
  where (select names from profile_columns)
    is distinct from array['avatar_url', 'created_at', 'id', 'nickname']::text[]
    or exists (
      select 1
      from (
        values
          ('id', 'uuid', 'NO'),
          ('created_at', 'timestamp with time zone', 'NO'),
          ('nickname', 'character varying', 'YES'),
          ('avatar_url', 'character varying', 'YES')
      ) as expected(column_name, data_type, is_nullable)
      left join information_schema.columns as actual
        on actual.table_schema::text = 'public'
        and actual.table_name::text = 'profiles'
        and actual.column_name::text = expected.column_name
      where actual.column_name is null
        or actual.data_type::text <> expected.data_type
        or actual.is_nullable::text <> expected.is_nullable
    )
  union all
  select 'PROFILES_CREATED_AT_DEFAULT_MISSING'
  where not exists (
    select 1 from information_schema.columns
    where table_schema::text = 'public'
      and table_name::text = 'profiles'
      and column_name::text = 'created_at'
      and column_default is not null
  )
  union all
  select 'AUTH_USERS_MISSING_PUBLIC_PROFILES'
  where exists (
    select 1
    from auth.users as auth_user
    left join public.profiles as public_profile on public_profile.id = auth_user.id
    where public_profile.id is null
  )
  union all
  select 'HANDLE_NEW_USER_BROWSER_EXECUTE'
  where exists (
    select 1
    from function_state
    where pg_catalog.has_function_privilege('anon', oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')
  )
)
select
  case when exists (select 1 from findings) then 'FAIL' else 'PASS' end as status,
  coalesce((select jsonb_agg(code order by code) from findings), '[]'::jsonb) as findings;
