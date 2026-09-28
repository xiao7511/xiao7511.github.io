-- Phase 4.5: reuse and harden the existing avatars bucket without changing profile data.
begin;

do $preflight$
declare
  bucket storage.buckets%rowtype;
  unexpected_policies text;
begin
  select * into bucket from storage.buckets where id = 'avatars';
  if not found then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
  elsif not (
    bucket.name = 'avatars'
    and bucket.public is true
    and bucket.file_size_limit = 5242880
    and bucket.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  ) then
    raise exception 'Phase 4.5 blocked: existing avatars bucket configuration requires manual review';
  end if;

  select string_agg(format('%I [%s roles=%s] qual=%s with_check=%s', policyname, cmd, roles, qual, with_check), '; ')
  into unexpected_policies
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and (coalesce(qual, '') ilike '%avatars%' or coalesce(with_check, '') ilike '%avatars%')
    and policyname not in ('avatar owner insert', 'avatar owner update', 'avatar owner delete');

  if unexpected_policies is not null then
    raise exception 'Phase 4.5 blocked: review existing avatars write policies: %', unexpected_policies;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public' and class.relname = 'profiles' and class.relrowsecurity
  ) or not pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE') then
    raise exception 'Phase 4.5 blocked: profiles avatar_url owner update baseline is unavailable';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
      and coalesce(qual, '') ilike '%id%auth.uid()%'
      and coalesce(with_check, '') ilike '%id%auth.uid()%'
  ) then
    raise exception 'Phase 4.5 blocked: profiles owner UPDATE policy is unavailable or unsafe';
  end if;
end
$preflight$;

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects for select to public
using (bucket_id = 'avatars');

drop policy if exists "avatar owner insert" on storage.objects;
create policy "avatar owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or name ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp)$')
  )
);

drop policy if exists "avatar owner update" on storage.objects;
create policy "avatar owner update" on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or name ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp)$')
  )
)
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or name ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp)$')
  )
);

drop policy if exists "avatar owner delete" on storage.objects;
create policy "avatar owner delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or name ~ ('^' || auth.uid()::text || '\.(jpg|jpeg|png|webp)$')
  )
);

commit;
