-- Read-only verifier for 202610010001_admin_user_list_rpc.sql.
do $$
declare
  function_oid oid := pg_catalog.to_regprocedure('public.list_admin_users()');
  function_result text;
  function_config text[];
  function_is_definer boolean;
  function_source text;
  function_argument_count smallint;
  users_rls_enabled boolean;
begin
  if function_oid is null then
    raise exception 'ADMIN_USER_LIST_FUNCTION: FAIL (function missing)';
  end if;

  select
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig,
    procedure.prosecdef,
    procedure.prosrc,
    procedure.pronargs
  into function_result, function_config, function_is_definer, function_source, function_argument_count
  from pg_catalog.pg_proc as procedure
  where procedure.oid = function_oid
    and procedure.pronargs = 0;

  if function_result is distinct from
    'TABLE(id uuid, email text, is_admin boolean, created_at timestamp with time zone)' then
    raise exception 'ADMIN_USER_LIST_RETURN_SHAPE: FAIL (%)', function_result;
  end if;
  if function_config is distinct from array['search_path=pg_catalog'] then
    raise exception 'ADMIN_USER_LIST_SEARCH_PATH: FAIL (%)', function_config;
  end if;
  if function_is_definer is distinct from true then
    raise exception 'ADMIN_USER_LIST_SECURITY_DEFINER: FAIL';
  end if;
  if function_argument_count <> 0 then
    raise exception 'ADMIN_USER_LIST_ARGUMENTS: FAIL';
  end if;
  if pg_catalog.strpos(function_source, 'auth.uid()') = 0
     or pg_catalog.strpos(function_source, 'public.is_admin()') = 0 then
    raise exception 'ADMIN_USER_LIST_AUTHORIZATION: FAIL';
  end if;
  if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE') then
    raise exception 'ADMIN_USER_LIST_ANON_EXECUTE: FAIL';
  end if;
  if pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE') is distinct from true then
    raise exception 'ADMIN_USER_LIST_AUTHENTICATED_EXECUTE: FAIL';
  end if;
  if exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        (select procedure.proacl from pg_catalog.pg_proc as procedure where procedure.oid = function_oid),
        pg_catalog.acldefault('f', (select procedure.proowner from pg_catalog.pg_proc as procedure where procedure.oid = function_oid))
      )
    ) as acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'ADMIN_USER_LIST_PUBLIC_EXECUTE: FAIL';
  end if;

  select relation.relrowsecurity
  into users_rls_enabled
  from pg_catalog.pg_class as relation
  where relation.oid = 'public.users'::regclass;
  if users_rls_enabled is distinct from true then
    raise exception 'USERS_RLS: FAIL';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'users'
      and policy.cmd in ('SELECT', 'ALL')
      and (policy.roles @> array['public']::name[] or policy.roles @> array['anon']::name[])
  ) then
    raise exception 'USERS_BROAD_SELECT_POLICY: FAIL';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.users', 'SELECT')
     and exists (
       select 1
       from pg_catalog.pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = 'users'
         and policy.cmd in ('SELECT', 'ALL')
         and (policy.roles @> array['public']::name[] or policy.roles @> array['anon']::name[])
     ) then
    raise exception 'USERS_ANON_SELECT_CAPABILITY: FAIL';
  end if;

  if pg_catalog.to_regprocedure('public.is_admin()') is null then
    raise exception 'IS_ADMIN_FUNCTION: FAIL';
  end if;
  if pg_catalog.to_regprocedure('public.set_user_admin(uuid,boolean)') is null then
    raise exception 'SET_USER_ADMIN_FUNCTION: FAIL';
  end if;
end
$$;

select 'PASS' as admin_user_list_rpc_verifier;
