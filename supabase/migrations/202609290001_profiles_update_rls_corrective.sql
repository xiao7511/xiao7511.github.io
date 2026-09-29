-- Phase 4.5.2: make the profile owner UPDATE boundary reproducible in every environment.
begin;

do $preflight$
begin
  if pg_catalog.to_regclass('public.profiles') is null then
    raise exception 'Phase 4.5.2 requires public.profiles';
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
    raise exception 'public.profiles does not match the required Phase 4.5.2 schema';
  end if;
end
$preflight$;

alter table public.profiles enable row level security;

-- Remove browser UPDATE grants without changing SELECT or INSERT privileges.
revoke update on table public.profiles from public, anon, authenticated;
do $revoke_columns$
declare
  editable_columns text;
begin
  select string_agg(pg_catalog.quote_ident(column_name), ', ' order by ordinal_position)
  into editable_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles';
  if editable_columns is not null then
    execute format(
      'revoke update (%s) on table public.profiles from public, anon, authenticated',
      editable_columns
    );
  end if;
end
$revoke_columns$;
grant update (nickname, avatar_url) on table public.profiles to authenticated;

-- Replace only UPDATE policies. Existing SELECT and INSERT policies are preserved.
do $drop_update_policies$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.profiles', policy_row.policyname);
  end loop;
end
$drop_update_policies$;

create policy "profiles own update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

do $postcondition$
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.profiles'::regclass and relrowsecurity
  ) then
    raise exception 'public.profiles RLS is not enabled';
  end if;
  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  ) <> 1 then
    raise exception 'public.profiles must have exactly one UPDATE policy';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles own update'
      and cmd = 'UPDATE'
      and roles = array['authenticated']::name[]
      and qual = '(auth.uid() = id)'
      and with_check = '(auth.uid() = id)'
  ) then
    raise exception 'profiles own update policy is missing or unsafe';
  end if;
  if exists (
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
    or pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    or not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE')
    or not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
  then
    raise exception 'public.profiles UPDATE privileges are unsafe';
  end if;
end
$postcondition$;

commit;
