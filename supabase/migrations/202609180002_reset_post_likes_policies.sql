-- Remove legacy restrictive policies that can override valid like operations.
begin;

alter table public.post_likes enable row level security;

grant select on table public.post_likes to anon, authenticated;
grant insert, delete on table public.post_likes to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
  loop
    execute format('drop policy %I on public.post_likes', existing_policy.policyname);
  end loop;
end
$$;

create policy "likes public read"
on public.post_likes
as permissive
for select
to anon, authenticated
using (true);

create policy "likes own insert"
on public.post_likes
as permissive
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "likes own delete"
on public.post_likes
as permissive
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
