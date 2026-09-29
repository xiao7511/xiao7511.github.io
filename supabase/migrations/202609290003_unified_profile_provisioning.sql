-- Phase 4.6.1A-5B: make public.profiles part of the canonical auth.users provisioning transaction.
begin;

-- 1. Fail closed on an unknown production shape before replacing the trigger function.
do $preflight$
declare
  handle_function oid := pg_catalog.to_regprocedure('public.handle_new_user()');
  actual_profile_columns text[];
  expected_profile_columns constant text[] := array['avatar_url', 'created_at', 'id', 'nickname'];
begin
  if pg_catalog.to_regclass('auth.users') is null
    or pg_catalog.to_regclass('game.profiles') is null
    or pg_catalog.to_regclass('public.users') is null
    or pg_catalog.to_regclass('public.profiles') is null
  then
    raise exception 'Unified profile provisioning requires auth.users, game.profiles, public.users and public.profiles';
  end if;

  select array_agg(columns.column_name order by columns.column_name)
  into actual_profile_columns
  from information_schema.columns as columns
  where columns.table_schema = 'public' and columns.table_name = 'profiles';

  if actual_profile_columns is distinct from expected_profile_columns then
    raise exception 'public.profiles columns changed; expected %, found %',
      expected_profile_columns,
      actual_profile_columns;
  end if;

  if exists (
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
  ) then
    raise exception 'public.profiles does not match the required production schema';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'created_at'
      and column_default is not null
  ) then
    raise exception 'public.profiles.created_at must retain its existing default';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = index_row.indrelid
      and index_row.indkey[0] = attribute.attnum
    where index_row.indrelid = 'public.profiles'::regclass
      and index_row.indisunique
      and index_row.indnkeyatts = 1
      and index_row.indpred is null
      and index_row.indexprs is null
      and attribute.attname = 'id'
  ) then
    raise exception 'public.profiles.id must have a single-column PRIMARY KEY or UNIQUE index';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'game' and table_name = 'profiles' and column_name in ('id', 'email')
    group by table_schema, table_name
    having count(*) = 2
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name in ('id', 'email', 'is_admin')
    group by table_schema, table_name
    having count(*) = 3
  ) then
    raise exception 'Existing game.profiles/public.users provisioning columns are unavailable';
  end if;

  if handle_function is null then
    raise exception 'public.handle_new_user() is required';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = handle_function
      and procedure.prorettype = 'trigger'::regtype
      and procedure.prosecdef
      and procedure.proconfig = array['search_path=pg_catalog']
      and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) then
    raise exception 'public.handle_new_user() must be a postgres-owned hardened SECURITY DEFINER trigger function';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'auth.users'::regclass
      and trigger_row.tgname = 'on_auth_user_created'
      and trigger_row.tgfoid = handle_function
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
      and pg_catalog.pg_get_triggerdef(trigger_row.oid) ilike '%AFTER INSERT%'
  ) then
    raise exception 'auth.users.on_auth_user_created must remain the enabled AFTER INSERT public.handle_new_user() trigger';
  end if;
end
$preflight$;

-- Block concurrent registrations until function replacement and backfill commit together.
lock table auth.users in share mode;
lock table public.profiles in share row exclusive mode;

-- 2. Preserve the existing game/account provisioning and add the minimal personal profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  insert into game.profiles (id, email)
  values (new.id, new.email);

  insert into public.users (id, email, is_admin)
  values (new.id, new.email, false);

  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$function$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 3. Backfill only missing rows. Existing nickname/avatar_url values are never updated.
insert into public.profiles (id)
select auth_user.id
from auth.users as auth_user
where not exists (
  select 1
  from public.profiles as public_profile
  where public_profile.id = auth_user.id
)
on conflict (id) do nothing;

-- 4. Refuse to commit if the canonical function, trigger or profile mapping is incomplete.
do $postcondition$
declare
  function_definition text := pg_catalog.pg_get_functiondef('public.handle_new_user()'::regprocedure);
begin
  if exists (
    select 1
    from auth.users as auth_user
    left join public.profiles as public_profile on public_profile.id = auth_user.id
    where public_profile.id is null
  ) then
    raise exception 'One or more auth.users rows still lack public.profiles';
  end if;

  if function_definition not ilike '%insert into game.profiles (id, email)%'
    or function_definition not ilike '%insert into public.users (id, email, is_admin)%'
    or function_definition not ilike '%insert into public.profiles (id)%'
    or function_definition not ilike '%on conflict (id) do nothing%'
  then
    raise exception 'public.handle_new_user() lost part of the canonical provisioning contract';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.handle_new_user()'::regprocedure
      and procedure.prosecdef
      and procedure.proconfig = array['search_path=pg_catalog']
      and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) then
    raise exception 'public.handle_new_user() security configuration is unsafe';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'auth.users'::regclass
      and trigger_row.tgname = 'on_auth_user_created'
      and trigger_row.tgfoid = 'public.handle_new_user()'::regprocedure
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
      and pg_catalog.pg_get_triggerdef(trigger_row.oid) ilike '%AFTER INSERT%'
  ) then
    raise exception 'Canonical auth.users provisioning trigger is unavailable';
  end if;
end
$postcondition$;

commit;
