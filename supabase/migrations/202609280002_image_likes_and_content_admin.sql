-- Phase 4.5.1: non-destructive home content state and authenticated image likes.
begin;

do $preflight$
begin
  if pg_catalog.to_regclass('public.content_management') is null
    or pg_catalog.to_regclass('public.image_likes') is null
  then
    raise exception 'Phase 4.5.1 requires content_management and image_likes';
  end if;
  if pg_catalog.to_regprocedure('public.is_admin()') is null
    or pg_catalog.to_regprocedure('public.get_image_like_summary(text[],uuid)') is null
    or pg_catalog.to_regprocedure('public.toggle_image_like(uuid,text,integer,text,uuid)') is null
  then
    raise exception 'Phase 4.5.1 requires the existing V2 security and engagement RPCs';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'content_management' and column_name = 'is_active'
      and data_type <> 'boolean'
  ) then
    raise exception 'content_management.is_active exists with an incompatible type';
  end if;
  if exists (
    select 1 from public.content_management
    where category in ('anime', 'manga') and (slot_index < 0 or slot_index >= 1000000)
  ) then
    raise exception 'Content slot values must be between 0 and 999999 before safe reordering';
  end if;
end
$preflight$;

alter table public.content_management add column if not exists is_active boolean;
update public.content_management set is_active = true where is_active is null;
alter table public.content_management alter column is_active set default true;
alter table public.content_management alter column is_active set not null;

create or replace function public.save_home_content_order(p_category text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  supplied_count integer;
  existing_count integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_category is null or p_category not in ('anime', 'manga')
    or p_items is null or jsonb_typeof(p_items) <> 'array'
  then
    raise exception 'Invalid home content payload';
  end if;

  supplied_count := jsonb_array_length(p_items);
  if exists (
    select 1 from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ? 'id' and item.value ? 'slot_index' and item.value ? 'is_active')
  ) then
    raise exception 'Invalid home content item';
  end if;
  if (
    select count(distinct parsed.id)
    from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
  ) <> supplied_count then
    raise exception 'Home content ids must be unique';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
    where parsed.id is null or parsed.slot_index is null or parsed.is_active is null
  ) then
    raise exception 'Home content fields cannot be null';
  end if;
  if (
    select count(distinct parsed.slot_index)
    from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
    where parsed.slot_index between 0 and greatest(supplied_count - 1, 0)
  ) <> supplied_count then
    raise exception 'Home content slots must be contiguous and unique';
  end if;
  if (
    select count(*)
    from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
    where parsed.is_active
  ) > 6 then
    raise exception 'A home section can enable at most six items';
  end if;

  perform 1
  from public.content_management as content
  where content.category = p_category
  for update;

  select count(*) into existing_count
  from public.content_management as content
  where content.category = p_category;
  if existing_count <> supplied_count or exists (
    select 1
    from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
    left join public.content_management as content
      on content.id = parsed.id and content.category = p_category
    where content.id is null
  ) then
    raise exception 'Home content payload must contain every current category row exactly once';
  end if;

  update public.content_management as content
  set slot_index = content.slot_index + 1000000
  where content.category = p_category;

  update public.content_management as content
  set slot_index = parsed.slot_index,
      is_active = parsed.is_active,
      updated_at = pg_catalog.now()
  from jsonb_to_recordset(p_items) as parsed(id uuid, slot_index integer, is_active boolean)
  where content.id = parsed.id and content.category = p_category;
end;
$$;
revoke all on function public.save_home_content_order(text, jsonb) from public, anon, authenticated;
grant execute on function public.save_home_content_order(text, jsonb) to authenticated;

create or replace function public.get_image_like_summary(
  p_image_keys text[],
  p_anonymous_id uuid default null
)
returns table (image_key text, like_count bigint, liked boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if coalesce(cardinality(p_image_keys), 0) = 0 then return; end if;
  if cardinality(p_image_keys) > 100 then raise exception 'A maximum of 100 image keys is allowed'; end if;
  if exists (
    select 1 from pg_catalog.unnest(p_image_keys) as requested(image_key)
    where requested.image_key is null
      or char_length(requested.image_key) not between 3 and 2048
      or requested.image_key !~ '^[^/?#]+/.+$'
  ) then
    raise exception 'Invalid image key';
  end if;
  return query
  select likes.image_key, count(*)::bigint,
    coalesce(bool_or(auth.uid() is not null and likes.user_id = auth.uid()), false)
  from public.image_likes as likes
  where likes.image_key = any(p_image_keys)
  group by likes.image_key;
end;
$$;
revoke all on function public.get_image_like_summary(text[], uuid) from public, anon, authenticated;
grant execute on function public.get_image_like_summary(text[], uuid) to anon, authenticated;

create or replace function public.toggle_image_like(
  p_content_id uuid,
  p_image_kind text,
  p_image_index integer,
  p_image_key text,
  p_anonymous_id uuid default null
)
returns table (liked boolean, like_count bigint)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  content_category text;
  content_cover_url text;
  content_detail_urls jsonb;
  target_exists boolean := false;
  removed_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_content_id is null or p_image_kind not in ('banner', 'cover', 'detail')
    or p_image_index is null or p_image_index < 0 or p_image_key is null
    or char_length(p_image_key) not between 3 and 2048 or p_image_key !~ '^[^/?#]+/.+$'
  then
    raise exception 'Invalid image target';
  end if;

  select content.category::text, content.cover_url::text,
    case when jsonb_typeof(to_jsonb(content.detail_urls)) = 'array'
      then to_jsonb(content.detail_urls) else '[]'::jsonb end
  into content_category, content_cover_url, content_detail_urls
  from public.content_management as content
  where content.id = p_content_id and content.is_active
  for share;
  if not found then raise exception 'Image target is not part of an active content record'; end if;

  target_exists :=
    (p_image_kind = 'banner' and content_category = 'banner' and p_image_index = 0
      and public.nobi_storage_image_key(content_cover_url) = p_image_key)
    or (p_image_kind = 'cover' and content_category <> 'banner' and p_image_index = 0
      and public.nobi_storage_image_key(content_cover_url) = p_image_key)
    or (p_image_kind = 'detail' and exists (
      select 1 from pg_catalog.jsonb_array_elements_text(content_detail_urls)
        with ordinality as detail(image_url, position)
      where detail.position - 1 = p_image_index
        and public.nobi_storage_image_key(detail.image_url) = p_image_key
    ));
  if not target_exists then raise exception 'Image target is not part of the current content record'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user:' || current_user_id::text || E'\x1f' || p_image_key, 0)
  );
  delete from public.image_likes as likes
  where likes.image_key = p_image_key and likes.user_id = current_user_id;
  get diagnostics removed_count = row_count;
  if removed_count = 0 then
    insert into public.image_likes (image_key, content_id, image_kind, image_index, user_id, anonymous_id)
    values (p_image_key, p_content_id, p_image_kind, p_image_index, current_user_id, null);
  end if;
  return query
  select removed_count = 0, count(*)::bigint
  from public.image_likes as likes where likes.image_key = p_image_key;
end;
$$;
revoke all on function public.toggle_image_like(uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.toggle_image_like(uuid, text, integer, text, uuid) to authenticated;

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
  shanghai_today date := (pg_catalog.now() at time zone 'Asia/Shanghai')::date;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'total_views', (select count(*) from public.page_views),
    'today_views', (select count(*) from public.page_views where viewed_on = shanghai_today),
    'total_posts', (select count(*) from public.posts where parent_id is null),
    'post_likes', (select count(*) from public.post_likes),
    'image_likes', (select count(*) from public.image_likes),
    'today_image_likes', (
      select count(*) from public.image_likes
      where (created_at at time zone 'Asia/Shanghai')::date = shanghai_today
    ),
    'views_7d', coalesce((
      select jsonb_agg(day_row order by day_row->>'day') from (
        select jsonb_build_object('day', calendar.day, 'views', count(page_views.id),
          'visitors', count(distinct page_views.visitor_id)) as day_row
        from (
          select shanghai_today - (6 - series.day_offset)::integer as day
          from pg_catalog.generate_series(0, 6) as series(day_offset)
        ) as calendar
        left join public.page_views on page_views.viewed_on = calendar.day
        group by calendar.day
      ) as daily
    ), '[]'::jsonb),
    'popular_images', coalesce((
      select jsonb_agg(popular order by (popular->>'likes')::bigint desc) from (
        select jsonb_build_object('image_key', likes.image_key,
          'content_id', max(likes.content_id::text), 'title', max(content.title),
          'image_kind', max(likes.image_kind), 'image_index', max(likes.image_index),
          'likes', count(*)) as popular
        from public.image_likes as likes
        join public.content_management as content on content.id = likes.content_id
        group by likes.image_key order by count(*) desc limit 5
      ) as ranked
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

do $postcondition$
declare
  signature text;
  function_oid oid;
begin
  foreach signature in array array[
    'public.save_home_content_order(text,jsonb)',
    'public.get_image_like_summary(text[],uuid)',
    'public.toggle_image_like(uuid,text,integer,text,uuid)',
    'public.get_admin_dashboard_stats()'
  ]
  loop
    function_oid := pg_catalog.to_regprocedure(signature);
    if function_oid is null or not exists (
      select 1 from pg_catalog.pg_proc
      where oid = function_oid and prosecdef
        and proconfig = array['search_path=pg_catalog']
        and pg_catalog.pg_get_userbyid(proowner) = 'postgres'
    ) then
      raise exception 'Phase 4.5.1 function is missing or unsafe: %', signature;
    end if;
  end loop;
  if pg_catalog.has_function_privilege('anon', 'public.toggle_image_like(uuid,text,integer,text,uuid)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'public.save_home_content_order(text,jsonb)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.toggle_image_like(uuid,text,integer,text,uuid)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.save_home_content_order(text,jsonb)', 'EXECUTE')
  then
    raise exception 'Phase 4.5.1 function privileges are unsafe';
  end if;
end
$postcondition$;

commit;
