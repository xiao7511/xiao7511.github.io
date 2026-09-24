-- Keep community likes and administrator totals in one atomic database operation.
begin;

create or replace function public.toggle_post_like(
  p_post_id bigint,
  p_remove boolean default false
)
returns table (liked boolean, like_count bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.posts where id = p_post_id and parent_id is null) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(p_post_id);

  if p_remove then
    delete from public.post_likes
    where post_id = p_post_id and user_id = current_user_id;
  else
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, current_user_id)
    on conflict (post_id, user_id) do nothing;
  end if;

  return query
  select
    exists (
      select 1 from public.post_likes
      where post_id = p_post_id and user_id = current_user_id
    ),
    (select count(*) from public.post_likes where post_id = p_post_id);
end;
$$;

revoke all on function public.toggle_post_like(bigint, boolean) from public, anon, authenticated;
grant execute on function public.toggle_post_like(bigint, boolean) to authenticated;

commit;
