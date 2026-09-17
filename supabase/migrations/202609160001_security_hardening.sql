-- Stage 2 security baseline. Run through the Supabase migration pipeline as the database owner.
begin;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.content_management enable row level security;
alter table public.site_config enable row level security;
alter table public.deployed_images enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Clients may edit their public profile, but never promote themselves.
revoke update on public.profiles from authenticated;
grant update (nickname, avatar_url, avatar) on public.profiles to authenticated;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid() and coalesce(is_admin, false) = false);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (true);
drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert" on public.posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "posts owner update" on public.posts;
create policy "posts owner update" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "posts owner or admin delete" on public.posts;
create policy "posts owner or admin delete" on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Likes are normalized so a user can only mutate their own reaction.
create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create policy "likes public read" on public.post_likes for select using (true);
create policy "likes own insert" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes own delete" on public.post_likes for delete to authenticated using (user_id = auth.uid());

create policy "content public read" on public.content_management for select using (true);
create policy "content admin write" on public.content_management for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "site config public read" on public.site_config for select using (true);
create policy "site config admin write" on public.site_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "deployed images public read" on public.deployed_images for select using (true);
create policy "deployed images admin write" on public.deployed_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The public bucket is readable; only admins can create, replace, or delete objects.
drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images admin insert" on storage.objects;
create policy "images admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "images admin update" on storage.objects;
create policy "images admin update" on storage.objects for update to authenticated using (bucket_id = 'images' and public.is_admin()) with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "images admin delete" on storage.objects;
create policy "images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'images' and public.is_admin());

commit;
