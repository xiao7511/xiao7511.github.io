-- One optional image per community reply. Apply through the Supabase migration pipeline as database owner.
-- This migration fails closed when the Phase 4 posts baseline, bucket configuration, grants or policies have drifted.
begin;

do $migration_preconditions$
declare
  posts_rls_enabled boolean;
  owner_insert_ok boolean;
  owner_update_ok boolean;
  conflicting_storage_policies text;
  conflicting_posts_policies text;
  unexpected_posts_grants text;
begin
  if pg_catalog.to_regclass('public.posts') is null then
    raise exception 'Phase 4.2 blocked: public.posts does not exist';
  end if;
  if pg_catalog.to_regclass('storage.buckets') is null or pg_catalog.to_regclass('storage.objects') is null then
    raise exception 'Phase 4.2 blocked: Supabase Storage tables do not exist';
  end if;

  select class.relrowsecurity
  into posts_rls_enabled
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public' and class.relname = 'posts';
  if not coalesce(posts_rls_enabled, false) then
    raise exception 'Phase 4.2 blocked: row level security is not enabled on public.posts';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'posts'
      and policy.policyname = 'posts owner insert'
      and policy.cmd = 'INSERT'
      and policy.permissive = 'PERMISSIVE'
      and policy.roles && array['authenticated']::name[]
      and coalesce(policy.with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(policy.with_check, '')) !~ '\mor\M'
  ) into owner_insert_ok;

  select exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'posts'
      and policy.policyname = 'posts owner update'
      and policy.cmd = 'UPDATE'
      and policy.permissive = 'PERMISSIVE'
      and policy.roles && array['authenticated']::name[]
      and coalesce(policy.qual, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and coalesce(policy.with_check, '') ~* 'user_id\s*=\s*auth\.uid\(\)'
      and pg_catalog.lower(coalesce(policy.qual, '')) !~ '\mor\M'
      and pg_catalog.lower(coalesce(policy.with_check, '')) !~ '\mor\M'
  ) into owner_update_ok;

  if not owner_insert_ok or not owner_update_ok then
    raise exception 'Phase 4.2 blocked: posts owner INSERT/UPDATE policies are missing or have drifted';
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format('%s [%s, roles=%s]', policy.policyname, policy.cmd, policy.roles::text),
    ', ' order by policy.policyname
  )
  into conflicting_posts_policies
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = 'posts'
    and policy.permissive = 'PERMISSIVE'
    and policy.cmd in ('ALL', 'INSERT', 'UPDATE')
    and policy.roles && array['public', 'anon', 'authenticated']::name[]
    and policy.policyname not in ('posts owner insert', 'posts owner update');

  if conflicting_posts_policies is not null then
    raise exception 'Phase 4.2 blocked: unexpected posts write policies require review: %',
      conflicting_posts_policies;
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format('%s [%s, roles=%s]', policy.policyname, policy.cmd, policy.roles::text),
    ', ' order by policy.policyname
  )
  into conflicting_storage_policies
  from pg_catalog.pg_policies as policy
  cross join lateral (
    select pg_catalog.lower(coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')) as expression
  ) as predicate
  where policy.schemaname = 'storage'
    and policy.tablename = 'objects'
    and policy.permissive = 'PERMISSIVE'
    and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and policy.roles && array['public', 'anon', 'authenticated']::name[]
    and policy.policyname not in (
      'community reply images owner insert',
      'community reply images owner delete'
    )
    and not (
      predicate.expression ~ 'bucket_id\s*=\s*''[a-z0-9_-]+''(::text)?'
      and predicate.expression !~ '''community'''
      and predicate.expression !~ '\mor\M'
    );

  if conflicting_storage_policies is not null then
    raise exception 'Phase 4.2 blocked: potentially permissive Storage write policies require review: %',
      conflicting_storage_policies;
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format('%s.%s [%s]', grant_row.grantee, grant_row.column_name, grant_row.privilege_type),
    ', ' order by grant_row.grantee, grant_row.privilege_type, grant_row.column_name
  )
  into unexpected_posts_grants
  from information_schema.column_privileges as grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = 'posts'
    and pg_catalog.lower(grant_row.grantee) in ('public', 'anon', 'authenticated')
    and grant_row.privilege_type in ('INSERT', 'UPDATE')
    and not (
      pg_catalog.lower(grant_row.grantee) = 'authenticated'
      and (
        (
          grant_row.privilege_type = 'INSERT'
          and grant_row.column_name = any (
            array['user_id', 'content', 'nickname', 'avatar_url', 'title', 'category', 'parent_id', 'image_path']
          )
        )
        or (
          grant_row.privilege_type = 'UPDATE'
          and grant_row.column_name = any (
            array['content', 'nickname', 'avatar_url', 'title', 'category', 'image_path']
          )
        )
      )
    );

  if exists (
    select 1
    from information_schema.table_privileges as table_grant
    where table_grant.table_schema = 'public'
      and table_grant.table_name = 'posts'
      and pg_catalog.lower(table_grant.grantee) in ('public', 'anon', 'authenticated')
      and table_grant.privilege_type in ('INSERT', 'UPDATE')
  ) then
    raise exception 'Phase 4.2 blocked: public.posts has a client table-level INSERT or UPDATE grant';
  end if;

  if unexpected_posts_grants is not null then
    raise exception 'Phase 4.2 blocked: unexpected public.posts column grants require review: %',
      unexpected_posts_grants;
  end if;
end;
$migration_preconditions$;

do $bucket_precondition$
declare
  existing_bucket storage.buckets%rowtype;
begin
  if exists (select 1 from storage.buckets where name = 'community' and id <> 'community') then
    raise exception 'Phase 4.2 blocked: bucket name community is already used by another bucket id';
  end if;
  select * into existing_bucket from storage.buckets where id = 'community';
  if not found then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('community', 'community', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
  elsif not (
    existing_bucket.name = 'community'
    and existing_bucket.public is true
    and existing_bucket.file_size_limit = 5242880
    and coalesce(existing_bucket.allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp'], false)
    and coalesce(existing_bucket.allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp'], false)
  ) then
    raise exception 'Phase 4.2 blocked: existing community bucket configuration requires manual review'
      using detail = pg_catalog.format(
        'name=%s public=%s file_size_limit=%s allowed_mime_types=%s',
        existing_bucket.name,
        existing_bucket.public,
        existing_bucket.file_size_limit,
        existing_bucket.allowed_mime_types
      );
  end if;
end;
$bucket_precondition$;

alter table public.posts add column if not exists image_path text;

alter table public.posts drop constraint if exists posts_reply_image_only_check;
alter table public.posts add constraint posts_reply_image_only_check
  check (
    image_path is null
    or (
      user_id is not null
      and parent_id is not null
      and image_path like 'community-replies/' || user_id::text || '/%'
      and image_path ~ '^community-replies/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  );

grant insert (user_id, content, nickname, avatar_url, title, category, parent_id, image_path)
  on table public.posts to authenticated;
grant update (content, nickname, avatar_url, title, category, image_path)
  on table public.posts to authenticated;

drop policy if exists "community reply images public read" on storage.objects;
create policy "community reply images public read" on storage.objects for select to public
using (bucket_id = 'community' and (storage.foldername(name))[1] = 'community-replies');

drop policy if exists "community reply images owner insert" on storage.objects;
create policy "community reply images owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community'
  and (storage.foldername(name))[1] = 'community-replies'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "community reply images owner delete" on storage.objects;
create policy "community reply images owner delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'community'
  and (storage.foldername(name))[1] = 'community-replies'
  and (storage.foldername(name))[2] = auth.uid()::text
);

commit;
