-- Secure the application permission-account mapping before applying NOBI V2 engagement.
-- public.users is not a profile table; browser-editable profile data lives elsewhere.
begin;

-- 1. Production structural assertions. Fail closed instead of adapting an unknown schema.
do $$
declare
  actual_columns text[];
  expected_columns constant text[] := array['created_at', 'email', 'id', 'is_admin'];
  handle_function oid := pg_catalog.to_regprocedure('public.handle_new_user()');
begin
  select array_agg(columns.column_name order by columns.column_name)
  into actual_columns
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'users';

  if actual_columns is distinct from expected_columns then
    raise exception 'public.users columns changed; expected %, found %. Review privileges before continuing.',
      expected_columns,
      actual_columns;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'id'
      and data_type = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception 'public.users.id must be NOT NULL uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'email'
      and data_type = 'text'
      and is_nullable = 'YES'
  ) then
    raise exception 'public.users.email must be nullable text';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_admin'
      and data_type = 'boolean'
      and is_nullable = 'YES'
      and column_default in ('false', 'false::boolean')
  ) then
    raise exception 'public.users.is_admin must be nullable boolean with a false default';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'created_at'
      and data_type = 'timestamp with time zone'
      and is_nullable = 'YES'
      and column_default in ('now()', 'CURRENT_TIMESTAMP')
  ) then
    raise exception 'public.users.created_at must be nullable timestamptz with a current-time default';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = index_row.indrelid
      and index_row.indkey[0] = attribute.attnum
    where index_row.indrelid = 'public.users'::regclass
      and index_row.indisunique
      and index_row.indnkeyatts = 1
      and index_row.indpred is null
      and index_row.indexprs is null
      and attribute.attname = 'id'
  ) then
    raise exception 'public.users.id must have a single-column PRIMARY KEY or UNIQUE index';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.users'::regclass
      and not trigger_row.tgisinternal
  ) then
    raise exception 'public.users gained an unexpected trigger; review it before continuing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    raise exception 'auth.users.id must be uuid';
  end if;

  if pg_catalog.to_regclass('game.profiles') is null then
    raise exception 'game.profiles is required by public.handle_new_user()';
  end if;
  if handle_function is null then
    raise exception 'public.handle_new_user() does not exist';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = handle_function
      and procedure.prorettype = 'trigger'::regtype
      and procedure.prosecdef
      and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) then
    raise exception 'public.handle_new_user() must be a postgres-owned SECURITY DEFINER trigger function';
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
    raise exception 'auth.users.on_auth_user_created must be an enabled AFTER INSERT trigger using public.handle_new_user()';
  end if;

  if exists (
    select 1
    from public.users as public_user
    left join auth.users as auth_user on auth_user.id = public_user.id
    where auth_user.id is null
  ) then
    raise exception 'public.users contains an id that does not exist in auth.users';
  end if;
end
$$;

-- Block concurrent registration and direct users writes until the new trigger function,
-- backfill, mapping checks and ACL changes commit together.
lock table auth.users in share mode;
lock table public.users in share row exclusive mode;

-- 2. Keep the existing single registration trigger and harden its function. Both
-- application inserts run inside the auth.users INSERT transaction; either failure
-- aborts the complete registration instead of silently suppressing a conflict.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into game.profiles (id, email)
  values (new.id, new.email);

  insert into public.users (id, email, is_admin)
  values (new.id, new.email, false);

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- CREATE OR REPLACE preserves ownership. Refuse to continue if that invariant changes.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.handle_new_user()'::regprocedure
      and procedure.prosecdef
      and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
      and procedure.proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'public.handle_new_user() owner or security configuration is unsafe';
  end if;
end
$$;

-- 3. Backfill only missing permission-account mappings. Existing rows, including
-- current administrator flags, are never updated.
insert into public.users (id, email, is_admin)
select auth_user.id, auth_user.email, false
from auth.users as auth_user
left join public.users as public_user on public_user.id = auth_user.id
where public_user.id is null;

-- 4. Mapping completeness is a transaction invariant.
do $$
declare
  auth_without_public_user bigint;
  public_without_auth_user bigint;
begin
  select count(*)
  into auth_without_public_user
  from auth.users as auth_user
  left join public.users as public_user on public_user.id = auth_user.id
  where public_user.id is null;

  select count(*)
  into public_without_auth_user
  from public.users as public_user
  left join auth.users as auth_user on auth_user.id = public_user.id
  where auth_user.id is null;

  if auth_without_public_user <> 0 or public_without_auth_user <> 0 then
    raise exception 'User mapping is incomplete: auth_without_public_user=%, public_without_auth_user=%',
      auth_without_public_user,
      public_without_auth_user;
  end if;
end
$$;

-- 5. Browser roles retain no direct write path to the permission-account table.
alter table public.users enable row level security;
revoke insert, update, delete, truncate, references, trigger
on table public.users
from public, anon, authenticated;

do $$
declare
  user_columns text;
begin
  select string_agg(pg_catalog.format('%I', columns.column_name), ', ' order by columns.ordinal_position)
  into user_columns
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'users';

  if user_columns is null then
    raise exception 'public.users does not exist or has no visible columns';
  end if;

  execute pg_catalog.format(
    'revoke insert (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
  execute pg_catalog.format(
    'revoke update (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
  execute pg_catalog.format(
    'revoke references (%s) on table public.users from public, anon, authenticated',
    user_columns
  );
end
$$;

-- Preserve a complete own-row RLS boundary in case safe columns are deliberately
-- granted in a future migration. This policy does not itself grant UPDATE.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policies.policyname
    from pg_catalog.pg_policies as policies
    where policies.schemaname = 'public'
      and policies.tablename = 'users'
      and policies.cmd = 'UPDATE'
  loop
    execute pg_catalog.format('drop policy %I on public.users', existing_policy.policyname);
  end loop;
end
$$;

drop policy if exists "users own row update" on public.users;
drop policy if exists "users update restricted to own row" on public.users;

create policy "users own row update"
on public.users
as permissive
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users update restricted to own row"
on public.users
as restrictive
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- 6. Missing application mappings and NULL flags always resolve to non-admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce((select users.is_admin from public.users as users where users.id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- 7. The only browser-callable administrator mutation path. The global transaction
-- lock prevents concurrent demotions from removing the final administrator.
create or replace function public.set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  administrator_count bigint;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nobi:set_user_admin', 0)
  );

  -- Recheck after waiting for the lock in case the caller was demoted meanwhile.
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_is_admin is null then
    raise exception 'Target user and administrator state are required';
  end if;
  if not exists (select 1 from public.users as users where users.id = p_user_id) then
    raise exception 'Target user not found';
  end if;

  if p_is_admin = false
    and exists (
      select 1
      from public.users as users
      where users.id = p_user_id and users.is_admin = true
    )
  then
    select count(*)
    into administrator_count
    from public.users as users
    where users.is_admin = true;

    if administrator_count <= 1 then
      raise exception 'At least one administrator must remain' using errcode = '23514';
    end if;
  end if;

  update public.users as users
  set is_admin = p_is_admin
  where users.id = p_user_id;

  if not found then
    raise exception 'Target user not found';
  end if;
end;
$$;
revoke all on function public.set_user_admin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;

-- SECURITY DEFINER functions must remain owned by the trusted database owner.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in ('handle_new_user', 'is_admin', 'set_user_admin')
      and (
        not procedure.prosecdef
        or pg_catalog.pg_get_userbyid(procedure.proowner) <> 'postgres'
        or procedure.proconfig is distinct from array['search_path=pg_catalog']
      )
  ) then
    raise exception 'A users security function has an unsafe owner or configuration';
  end if;
end
$$;

-- 8. Refuse to commit if inherited or PUBLIC privileges still expose a write path.
do $$
begin
  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    cross join information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = 'users'
      and (
        pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'INSERT'
        )
        or pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'UPDATE'
        )
        or pg_catalog.has_column_privilege(
          roles.role_name,
          'public.users',
          columns.column_name,
          'REFERENCES'
        )
      )
  ) then
    raise exception 'A public.users column write privilege is still reachable by a browser role';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    where pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'DELETE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRUNCATE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRIGGER')
  ) then
    raise exception 'A dangerous public.users table privilege is still reachable by a browser role';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.handle_new_user()',
      'EXECUTE'
    )
  then
    raise exception 'public.handle_new_user() must not be directly executable by browser roles';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
  then
    raise exception 'public.is_admin() has an unsafe EXECUTE ACL';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.set_user_admin(uuid,boolean)', 'EXECUTE')
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.set_user_admin(uuid,boolean)',
      'EXECUTE'
    )
  then
    raise exception 'public.set_user_admin(uuid, boolean) has an unsafe EXECUTE ACL';
  end if;
end
$$;

commit;
