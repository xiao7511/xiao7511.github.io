-- Phase 4.5.1 production follow-up: restore the content_management RLS boundary.
begin;

alter table public.content_management enable row level security;

-- Browser roles keep read access. Anonymous callers must have no direct write grant.
revoke insert, update, delete, truncate, references, trigger
on table public.content_management
from public, anon;

-- Table-level REVOKE does not remove column-level grants. Clear those explicitly
-- so anon cannot retain a write path through an older column ACL.
do $column_grants$
declare
  content_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into content_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'content_management';

  if content_columns is not null then
    execute format(
      'revoke insert (%s) on table public.content_management from public, anon',
      content_columns
    );
    execute format(
      'revoke update (%s) on table public.content_management from public, anon',
      content_columns
    );
  end if;
end
$column_grants$;

grant select on table public.content_management to anon, authenticated;
grant insert, update, delete on table public.content_management to authenticated;

drop policy if exists "Allow anonymous users to content_management" on public.content_management;
drop policy if exists "content public read" on public.content_management;
drop policy if exists "content admin write" on public.content_management;

create policy "content public read"
on public.content_management
as permissive
for select
to anon, authenticated
using (true);

create policy "content admin write"
on public.content_management
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $postcondition$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class as class
    where class.oid = 'public.content_management'::regclass
      and class.relrowsecurity
  ) then
    raise exception 'content_management RLS is not enabled';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.content_management', 'INSERT')
    or pg_catalog.has_table_privilege('anon', 'public.content_management', 'UPDATE')
    or pg_catalog.has_table_privilege('anon', 'public.content_management', 'DELETE')
    or pg_catalog.has_any_column_privilege('anon', 'public.content_management', 'INSERT')
    or pg_catalog.has_any_column_privilege('anon', 'public.content_management', 'UPDATE')
  then
    raise exception 'anon retains a direct content_management write grant';
  end if;

  if not pg_catalog.has_table_privilege('anon', 'public.content_management', 'SELECT')
    or not pg_catalog.has_table_privilege('authenticated', 'public.content_management', 'SELECT')
    or not pg_catalog.has_table_privilege('authenticated', 'public.content_management', 'INSERT')
    or not pg_catalog.has_table_privilege('authenticated', 'public.content_management', 'UPDATE')
    or not pg_catalog.has_table_privilege('authenticated', 'public.content_management', 'DELETE')
  then
    raise exception 'content_management browser grants do not match the reviewed contract';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'content_management'
      and policy.policyname = 'content public read'
      and policy.cmd = 'SELECT'
      and policy.roles @> array['anon', 'authenticated']::name[]
      and policy.qual = 'true'
  ) then
    raise exception 'content_management public read policy is missing or unsafe';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'content_management'
      and policy.policyname = 'content admin write'
      and policy.cmd = 'ALL'
      and policy.roles @> array['authenticated']::name[]
      and coalesce(policy.qual, '') ilike '%is_admin()%'
      and coalesce(policy.with_check, '') ilike '%is_admin()%'
  ) then
    raise exception 'content_management administrator write policy is missing or unsafe';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'content_management'
      and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and policy.policyname <> 'content admin write'
  ) then
    raise exception 'content_management has an additional write policy that requires manual review';
  end if;
end
$postcondition$;

commit;
