-- Production posts security baseline.
-- Ordered after Phase 4 trust/safety and before the Phase 4.2 reply-image migration.
begin;

do $preconditions$
begin
  if pg_catalog.to_regclass('public.posts') is null then
    raise exception 'Posts security baseline blocked: public.posts does not exist';
  end if;
  if pg_catalog.to_regclass('public.post_likes') is null then
    raise exception 'Posts security baseline blocked: public.post_likes does not exist';
  end if;
  if pg_catalog.to_regprocedure('public.toggle_post_like(bigint,boolean)') is null then
    raise exception 'Posts security baseline blocked: public.toggle_post_like(bigint, boolean) is required before legacy likes_users writes can be removed';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure('public.toggle_post_like(bigint,boolean)')
      and procedure.prosecdef
      and pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'Posts security baseline blocked: toggle_post_like RPC privileges are unsafe';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'post_likes'
      and class.relrowsecurity
  ) then
    raise exception 'Posts security baseline blocked: public.post_likes RLS is required';
  end if;
  if pg_catalog.to_regprocedure('public.review_post_report(bigint,text,text)') is null then
    raise exception 'Posts security baseline blocked: Phase 4 review_post_report RPC is required';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure('public.review_post_report(bigint,text,text)')
      and procedure.prosecdef
      and pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'Posts security baseline blocked: review_post_report RPC privileges are unsafe';
  end if;
end;
$preconditions$;

alter table public.posts enable row level security;
alter table public.posts no force row level security;

-- Do not FORCE RLS. The table-owning SECURITY DEFINER moderation RPC must retain
-- owner bypass while ordinary anon/authenticated requests remain subject to RLS.

-- Remove both table ACLs and explicit per-column ACLs before granting the exact
-- client write surface. SELECT and DELETE privileges are intentionally untouched.
revoke insert, update on table public.posts from public, anon, authenticated;

do $revoke_column_writes$
declare
  column_list text;
  target_role text;
  role_sql text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_ident(attribute.attname), ', ' order by attribute.attnum)
  into column_list
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.posts'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if column_list is null then
    raise exception 'Posts security baseline blocked: public.posts has no writable columns';
  end if;

  foreach target_role in array array['public', 'anon', 'authenticated']
  loop
    role_sql := case when target_role = 'public' then 'public' else pg_catalog.quote_ident(target_role) end;
    execute pg_catalog.format(
      'revoke insert (%s) on table public.posts from %s',
      column_list,
      role_sql
    );
    execute pg_catalog.format(
      'revoke update (%s) on table public.posts from %s',
      column_list,
      role_sql
    );
  end loop;
end;
$revoke_column_writes$;

grant insert (user_id, content, nickname, avatar_url, title, category, parent_id)
  on table public.posts to authenticated;
grant update (content, nickname, avatar_url, title, category)
  on table public.posts to authenticated;

-- A repeat deployment after Phase 4.2 must preserve the reply-image column ACL.
do $grant_optional_reply_image$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'image_path'
  ) then
    grant insert (image_path), update (image_path) on table public.posts to authenticated;
  end if;
end;
$grant_optional_reply_image$;

-- Replace every permissive client INSERT/UPDATE/ALL policy based on its command
-- and roles. This removes legacy policies even when their names differ by locale.
do $replace_client_write_policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policy.policyname
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'posts'
      and policy.permissive = 'PERMISSIVE'
      and policy.cmd in ('ALL', 'INSERT', 'UPDATE')
      and policy.roles && array['public', 'anon', 'authenticated']::name[]
  loop
    execute pg_catalog.format('drop policy %I on public.posts', existing_policy.policyname);
  end loop;
end;
$replace_client_write_policies$;

create policy "posts owner insert"
on public.posts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "posts owner update"
on public.posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;
