-- Repair post_likes privileges and RLS policies for existing deployments.
begin;

alter table public.post_likes enable row level security;

grant select on table public.post_likes to anon, authenticated;
grant insert, delete on table public.post_likes to authenticated;

drop policy if exists "likes public read" on public.post_likes;
drop policy if exists "likes own insert" on public.post_likes;
drop policy if exists "likes own delete" on public.post_likes;

create policy "likes public read"
on public.post_likes
for select
to anon, authenticated
using (true);

create policy "likes own insert"
on public.post_likes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "likes own delete"
on public.post_likes
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
