-- NOBI 动漫 V2: privacy-conscious page views, persistent image likes and admin metrics.
-- Production execution is blocked until supabase/production_preflight.sql has been reviewed.
begin;

-- Fail closed if the production authorization/uniqueness preconditions are not met.
-- The read-only preflight remains mandatory because policies and function owners require human review.
do $$
declare
  required_unique_column record;
  admin_function oid := pg_catalog.to_regprocedure('public.is_admin()');
  handle_function oid := pg_catalog.to_regprocedure('public.handle_new_user()');
  set_admin_function oid := pg_catalog.to_regprocedure('public.set_user_admin(uuid,boolean)');
begin
  if not exists (
    select 1
    from pg_catalog.pg_class as class
    where class.oid = 'public.users'::regclass
      and class.relrowsecurity
  ) then
    raise exception 'Production preflight failed: public.users must have RLS enabled';
  end if;

  if pg_catalog.has_column_privilege('anon', 'public.users', 'is_admin', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.users', 'is_admin', 'UPDATE')
  then
    raise exception 'Production preflight failed: anon/authenticated must not be able to update users.is_admin';
  end if;

  -- 202609210000_secure_users_admin_privilege.sql is an immutable prerequisite.
  -- V2 verifies that contract but never recreates or repairs its authorization functions.
  if admin_function is null or not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = admin_function
      and procedure.prorettype = 'boolean'::regtype
      and procedure.prosecdef
      and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
      and procedure.proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'Security migration prerequisite failed: public.is_admin() is missing or unsafe';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
  then
    raise exception 'Security migration prerequisite failed: public.is_admin() has an unsafe EXECUTE ACL';
  end if;

  if handle_function is null or set_admin_function is null or not exists (
    select 1
    from pg_catalog.pg_proc as handle_procedure
    join pg_catalog.pg_proc as admin_procedure on admin_procedure.oid = set_admin_function
    where handle_procedure.oid = handle_function
      and handle_procedure.prosecdef
      and admin_procedure.prosecdef
      and pg_catalog.pg_get_userbyid(handle_procedure.proowner) = 'postgres'
      and pg_catalog.pg_get_userbyid(admin_procedure.proowner) = 'postgres'
      and handle_procedure.proconfig = array['search_path=pg_catalog']
      and admin_procedure.proconfig = array['search_path=pg_catalog']
  ) then
    raise exception 'Security migration prerequisite failed: users security functions are missing or unsafe';
  end if;

  if pg_catalog.has_function_privilege('anon', handle_function, 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', handle_function, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', set_admin_function, 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', set_admin_function, 'EXECUTE')
  then
    raise exception 'Security migration prerequisite failed: users security function ACLs are unsafe';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    where pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'INSERT')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'UPDATE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'DELETE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRUNCATE')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'REFERENCES')
      or pg_catalog.has_table_privilege(roles.role_name, 'public.users', 'TRIGGER')
      or pg_catalog.has_any_column_privilege(roles.role_name, 'public.users', 'INSERT')
      or pg_catalog.has_any_column_privilege(roles.role_name, 'public.users', 'UPDATE')
      or pg_catalog.has_any_column_privilege(roles.role_name, 'public.users', 'REFERENCES')
  ) then
    raise exception 'Security migration prerequisite failed: a browser role can write public.users';
  end if;

  if exists (
    select 1
    from auth.users as auth_user
    full join public.users as public_user on public_user.id = auth_user.id
    where auth_user.id is null or public_user.id is null
  ) then
    raise exception 'Security migration prerequisite failed: auth.users and public.users mappings differ';
  end if;

  for required_unique_column in
    select *
    from (values
      ('public.users', 'id'),
      ('public.content_management', 'id'),
      ('public.site_config', 'section')
    ) as required(table_name, column_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_index as index_row
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = index_row.indrelid
        and index_row.indkey[0] = attribute.attnum
      where index_row.indrelid = required_unique_column.table_name::regclass
        and index_row.indisunique
        and index_row.indnkeyatts = 1
        and index_row.indpred is null
        and index_row.indexprs is null
        and attribute.attname = required_unique_column.column_name
    ) then
      raise exception 'Production preflight failed: %.% must have a single-column PRIMARY KEY or UNIQUE index',
        required_unique_column.table_name,
        required_unique_column.column_name;
    end if;
  end loop;

  if exists (
    select 1
    from public.site_config as config
    group by config.section
    having count(*) > 1
  ) then
    raise exception 'Production preflight failed: public.site_config contains duplicate section values';
  end if;
end
$$;

create table if not exists public.page_views (
  id bigint generated by default as identity primary key,
  session_id uuid not null,
  visitor_id uuid not null,
  page_path text not null,
  viewed_at timestamptz not null default now(),
  viewed_on date not null default ((now() at time zone 'Asia/Shanghai')::date),
  constraint page_views_page_path_check
    check (char_length(page_path) between 1 and 200 and page_path like '/%')
);

-- IF NOT EXISTS must not silently accept a table created with an incompatible shape.
do $$
declare
  actual_columns text[];
  expected_columns constant text[] := array[
    'id',
    'page_path',
    'session_id',
    'viewed_at',
    'viewed_on',
    'visitor_id'
  ];
  expected_column record;
begin
  select array_agg(attribute.attname order by attribute.attname)
  into actual_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.page_views'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if actual_columns is distinct from expected_columns then
    raise exception 'public.page_views columns are incompatible: expected %, found %',
      expected_columns,
      actual_columns;
  end if;

  for expected_column in
    select *
    from (values
      ('id', 'bigint', true),
      ('session_id', 'uuid', true),
      ('visitor_id', 'uuid', true),
      ('page_path', 'text', true),
      ('viewed_at', 'timestamp with time zone', true),
      ('viewed_on', 'date', true)
    ) as expected(name, data_type, required_not_null)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = 'public.page_views'::regclass
        and attribute.attname = expected_column.name
        and pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = expected_column.data_type
        and attribute.attnotnull = expected_column.required_not_null
        and not attribute.attisdropped
    ) then
      raise exception 'public.page_views has an incompatible % column', expected_column.name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.page_views'::regclass
      and constraint_row.contype = 'p'
      and constraint_row.conkey = array[(
        select attribute.attnum
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = 'public.page_views'::regclass and attribute.attname = 'id'
      )]::smallint[]
  ) then
    raise exception 'public.page_views must have id as its primary key';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.page_views'::regclass
      and attribute.attname = 'id'
      and attribute.attidentity in ('a', 'd')
  ) then
    raise exception 'public.page_views.id must be an identity column';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.page_views'::regclass
      and constraint_row.conname = 'page_views_page_path_check'
      and constraint_row.contype = 'c'
  ) then
    raise exception 'public.page_views is missing page_views_page_path_check';
  end if;
end
$$;

create index if not exists page_views_viewed_at_idx on public.page_views (viewed_at desc);
create index if not exists page_views_viewed_on_visitor_idx on public.page_views (viewed_on, visitor_id);
create index if not exists page_views_session_path_time_idx
  on public.page_views (session_id, page_path, viewed_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
    where index_class.relnamespace = 'public'::regnamespace
      and index_class.relname = 'page_views_session_path_time_idx'
      and index_row.indrelid = 'public.page_views'::regclass
      and pg_catalog.pg_get_indexdef(index_row.indexrelid) like '%(session_id, page_path, viewed_at DESC)%'
  ) then
    raise exception 'page_views_session_path_time_idx has an incompatible definition';
  end if;
end
$$;

alter table public.page_views enable row level security;
revoke all on table public.page_views from public, anon, authenticated;
revoke insert (id, session_id, visitor_id, page_path, viewed_at, viewed_on),
  update (id, session_id, visitor_id, page_path, viewed_at, viewed_on)
on table public.page_views
from public, anon, authenticated;

drop policy if exists "page views admin read" on public.page_views;
create policy "page views admin read"
on public.page_views
for select
to authenticated
using (public.is_admin());

create or replace function public.record_page_view(
  p_session_id uuid,
  p_visitor_id uuid,
  p_page_path text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_page_path text;
begin
  if p_session_id is null or p_visitor_id is null then
    raise exception 'Anonymous identifiers are required';
  end if;
  if p_page_path is null
    or char_length(p_page_path) > 2048
    or p_page_path ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid page path';
  end if;

  -- Page-view identity excludes query strings and fragments.
  normalized_page_path := split_part(split_part(btrim(p_page_path), '#', 1), '?', 1);
  if char_length(normalized_page_path) not between 1 and 200 or normalized_page_path not like '/%' then
    raise exception 'Invalid page path';
  end if;

  -- Serialize the complete five-second check/insert window for one session and page.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text || E'\x1f' || normalized_page_path, 0)
  );

  if exists (
    select 1
    from public.page_views as views
    where views.session_id = p_session_id
      and views.page_path = normalized_page_path
      and views.viewed_at > pg_catalog.now() - interval '5 seconds'
  ) then
    return;
  end if;

  insert into public.page_views (session_id, visitor_id, page_path)
  values (p_session_id, p_visitor_id, normalized_page_path);
end;
$$;

revoke all on function public.record_page_view(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_page_view(uuid, uuid, text) to anon, authenticated;

-- A stable image identity is the normalized public Storage bucket/object path.
-- Hostnames, query strings and fragments are intentionally excluded.
create or replace function public.nobi_storage_image_key(p_url text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  with normalized as (
    select split_part(split_part(btrim(p_url), '#', 1), '?', 1) as url
  ), matched as (
    select regexp_match(
      normalized.url,
      '^https?://[^/]+/storage/v1/object/public/([^/]+)/(.+)$',
      'i'
    ) as parts
    from normalized
  )
  select case
    when matched.parts is null or btrim(matched.parts[2], '/') = '' then null
    else lower(matched.parts[1]) || '/' || btrim(matched.parts[2], '/')
  end
  from matched
$$;
revoke all on function public.nobi_storage_image_key(text) from public, anon, authenticated;

create table if not exists public.image_likes (
  id bigint generated by default as identity primary key,
  image_key text not null,
  content_id uuid not null,
  image_kind text not null,
  image_index integer not null default 0,
  user_id uuid,
  anonymous_id uuid,
  created_at timestamptz not null default now(),
  constraint image_likes_key_check
    check (char_length(image_key) between 3 and 2048 and image_key ~ '^[^/?#]+/.+$'),
  constraint image_likes_kind_check
    check (image_kind in ('banner', 'cover', 'detail')),
  constraint image_likes_index_check
    check (image_index >= 0),
  constraint image_likes_one_actor check (
    (user_id is not null and anonymous_id is null)
    or (user_id is null and anonymous_id is not null)
  ),
  constraint image_likes_content_fk
    foreign key (content_id) references public.content_management(id) on delete cascade,
  constraint image_likes_user_fk
    foreign key (user_id) references auth.users(id) on delete cascade
);

do $$
declare
  actual_columns text[];
  expected_columns constant text[] := array[
    'anonymous_id',
    'content_id',
    'created_at',
    'id',
    'image_index',
    'image_key',
    'image_kind',
    'user_id'
  ];
  expected_column record;
begin
  select array_agg(attribute.attname order by attribute.attname)
  into actual_columns
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.image_likes'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if actual_columns is distinct from expected_columns then
    raise exception 'public.image_likes columns are incompatible: expected %, found %',
      expected_columns,
      actual_columns;
  end if;

  for expected_column in
    select *
    from (values
      ('id', 'bigint', true),
      ('image_key', 'text', true),
      ('content_id', 'uuid', true),
      ('image_kind', 'text', true),
      ('image_index', 'integer', true),
      ('user_id', 'uuid', false),
      ('anonymous_id', 'uuid', false),
      ('created_at', 'timestamp with time zone', true)
    ) as expected(name, data_type, required_not_null)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = 'public.image_likes'::regclass
        and attribute.attname = expected_column.name
        and pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) = expected_column.data_type
        and attribute.attnotnull = expected_column.required_not_null
        and not attribute.attisdropped
    ) then
      raise exception 'public.image_likes has an incompatible % column', expected_column.name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.image_likes'::regclass
      and constraint_row.contype = 'p'
      and constraint_row.conkey = array[(
        select attribute.attnum
        from pg_catalog.pg_attribute as attribute
        where attribute.attrelid = 'public.image_likes'::regclass and attribute.attname = 'id'
      )]::smallint[]
  ) then
    raise exception 'public.image_likes must have id as its primary key';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.image_likes'::regclass
      and attribute.attname = 'id'
      and attribute.attidentity in ('a', 'd')
  ) then
    raise exception 'public.image_likes.id must be an identity column';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.image_likes'::regclass
      and constraint_row.conname = any(array[
        'image_likes_key_check',
        'image_likes_kind_check',
        'image_likes_index_check',
        'image_likes_one_actor',
        'image_likes_content_fk',
        'image_likes_user_fk'
      ])
      and (
        (constraint_row.conname in (
          'image_likes_key_check',
          'image_likes_kind_check',
          'image_likes_index_check',
          'image_likes_one_actor'
        ) and constraint_row.contype = 'c')
        or (
          constraint_row.conname = 'image_likes_content_fk'
          and constraint_row.contype = 'f'
          and constraint_row.confrelid = 'public.content_management'::regclass
          and constraint_row.conkey = array[(
            select attribute.attnum
            from pg_catalog.pg_attribute as attribute
            where attribute.attrelid = 'public.image_likes'::regclass
              and attribute.attname = 'content_id'
          )]::smallint[]
          and constraint_row.confkey = array[(
            select attribute.attnum
            from pg_catalog.pg_attribute as attribute
            where attribute.attrelid = 'public.content_management'::regclass
              and attribute.attname = 'id'
          )]::smallint[]
          and constraint_row.confdeltype = 'c'
        )
        or (
          constraint_row.conname = 'image_likes_user_fk'
          and constraint_row.contype = 'f'
          and constraint_row.confrelid = 'auth.users'::regclass
          and constraint_row.conkey = array[(
            select attribute.attnum
            from pg_catalog.pg_attribute as attribute
            where attribute.attrelid = 'public.image_likes'::regclass
              and attribute.attname = 'user_id'
          )]::smallint[]
          and constraint_row.confkey = array[(
            select attribute.attnum
            from pg_catalog.pg_attribute as attribute
            where attribute.attrelid = 'auth.users'::regclass
              and attribute.attname = 'id'
          )]::smallint[]
          and constraint_row.confdeltype = 'c'
        )
      )
  ) <> 6 then
    raise exception 'public.image_likes is missing one or more required constraints';
  end if;
end
$$;

create unique index if not exists image_likes_user_unique_idx
  on public.image_likes (image_key, user_id)
  where user_id is not null;
create unique index if not exists image_likes_anonymous_unique_idx
  on public.image_likes (image_key, anonymous_id)
  where anonymous_id is not null;
create index if not exists image_likes_key_idx on public.image_likes (image_key);
create index if not exists image_likes_content_idx on public.image_likes (content_id);
create index if not exists image_likes_created_at_idx on public.image_likes (created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
    where index_class.relnamespace = 'public'::regnamespace
      and index_class.relname = 'image_likes_user_unique_idx'
      and index_row.indrelid = 'public.image_likes'::regclass
      and index_row.indisunique
      and pg_catalog.pg_get_indexdef(index_row.indexrelid) like '%(image_key, user_id)%'
      and pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid) = '(user_id IS NOT NULL)'
  ) then
    raise exception 'image_likes_user_unique_idx has an incompatible definition';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
    where index_class.relnamespace = 'public'::regnamespace
      and index_class.relname = 'image_likes_anonymous_unique_idx'
      and index_row.indrelid = 'public.image_likes'::regclass
      and index_row.indisunique
      and pg_catalog.pg_get_indexdef(index_row.indexrelid) like '%(image_key, anonymous_id)%'
      and pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid) = '(anonymous_id IS NOT NULL)'
  ) then
    raise exception 'image_likes_anonymous_unique_idx has an incompatible definition';
  end if;
end
$$;

alter table public.image_likes enable row level security;
revoke all on table public.image_likes from public, anon, authenticated;
revoke insert (id, image_key, content_id, image_kind, image_index, user_id, anonymous_id, created_at),
  update (id, image_key, content_id, image_kind, image_index, user_id, anonymous_id, created_at)
on table public.image_likes
from public, anon, authenticated;

drop policy if exists "image likes admin read" on public.image_likes;
create policy "image likes admin read"
on public.image_likes
for select
to authenticated
using (public.is_admin());

create or replace function public.get_image_like_summary(
  p_image_keys text[],
  p_anonymous_id uuid default null
)
returns table (
  image_key text,
  like_count bigint,
  liked boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if coalesce(cardinality(p_image_keys), 0) = 0 then
    return;
  end if;
  if cardinality(p_image_keys) > 100 then
    raise exception 'A maximum of 100 image keys is allowed';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(p_image_keys) as requested(image_key)
    where requested.image_key is null
      or char_length(requested.image_key) not between 3 and 2048
      or requested.image_key !~ '^[^/?#]+/.+$'
  ) then
    raise exception 'Invalid image key';
  end if;

  return query
  select
    likes.image_key,
    count(*)::bigint,
    coalesce(bool_or(
      case
        when auth.uid() is not null then likes.user_id = auth.uid()
        else likes.anonymous_id = p_anonymous_id
      end
    ), false)
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
  actor_key text;
  content_category text;
  content_cover_url text;
  content_detail_urls jsonb;
  target_exists boolean := false;
  removed_count integer := 0;
begin
  if p_content_id is null
    or p_image_kind is null
    or p_image_kind not in ('banner', 'cover', 'detail')
    or p_image_index is null
    or p_image_index < 0
    or p_image_key is null
    or char_length(p_image_key) not between 3 and 2048
    or p_image_key !~ '^[^/?#]+/.+$'
  then
    raise exception 'Invalid image target';
  end if;
  if current_user_id is null and p_anonymous_id is null then
    raise exception 'Anonymous identifier is required';
  end if;

  -- Keep the current content image set stable until validation and toggle finish.
  select
    content.category::text,
    content.cover_url::text,
    case
      when jsonb_typeof(to_jsonb(content.detail_urls)) = 'array' then to_jsonb(content.detail_urls)
      else '[]'::jsonb
    end
  into content_category, content_cover_url, content_detail_urls
  from public.content_management as content
  where content.id = p_content_id
  for share;

  if not found then
    raise exception 'Image target is not part of the current content record';
  end if;

  target_exists :=
    (
      p_image_kind = 'banner'
      and content_category = 'banner'
      and p_image_index = 0
      and public.nobi_storage_image_key(content_cover_url) = p_image_key
    )
    or (
      p_image_kind = 'cover'
      and content_category <> 'banner'
      and p_image_index = 0
      and public.nobi_storage_image_key(content_cover_url) = p_image_key
    )
    or (
      p_image_kind = 'detail'
      and exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(content_detail_urls)
          with ordinality as detail(image_url, position)
        where detail.position - 1 = p_image_index
          and public.nobi_storage_image_key(detail.image_url) = p_image_key
      )
    );

  if not target_exists then
    raise exception 'Image target is not part of the current content record';
  end if;

  actor_key := case
    when current_user_id is not null then 'user:' || current_user_id::text
    else 'anonymous:' || p_anonymous_id::text
  end;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_key || E'\x1f' || p_image_key, 0)
  );

  if current_user_id is not null then
    delete from public.image_likes as likes
    where likes.image_key = p_image_key
      and likes.user_id = current_user_id;
  else
    delete from public.image_likes as likes
    where likes.image_key = p_image_key
      and likes.anonymous_id = p_anonymous_id;
  end if;
  get diagnostics removed_count = row_count;

  if removed_count = 0 then
    insert into public.image_likes (
      image_key,
      content_id,
      image_kind,
      image_index,
      user_id,
      anonymous_id
    )
    values (
      p_image_key,
      p_content_id,
      p_image_kind,
      p_image_index,
      current_user_id,
      case when current_user_id is null then p_anonymous_id else null end
    );
  end if;

  return query
  select
    removed_count = 0,
    count(*)::bigint
  from public.image_likes as likes
  where likes.image_key = p_image_key;
end;
$$;

revoke all on function public.toggle_image_like(uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.toggle_image_like(uuid, text, integer, text, uuid) to anon, authenticated;

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
    'today_views', (
      select count(*)
      from public.page_views
      where viewed_on = shanghai_today
    ),
    'total_posts', (select count(*) from public.posts where parent_id is null),
    'post_likes', (select count(*) from public.post_likes),
    'image_likes', (select count(*) from public.image_likes),
    'views_7d', coalesce((
      select jsonb_agg(day_row order by day_row->>'day')
      from (
        select jsonb_build_object(
          'day', calendar.day,
          'views', count(page_views.id),
          'visitors', count(distinct page_views.visitor_id)
        ) as day_row
        from (
          select shanghai_today - (6 - series.day_offset)::integer as day
          from pg_catalog.generate_series(0, 6) as series(day_offset)
        ) as calendar
        left join public.page_views on page_views.viewed_on = calendar.day
        group by calendar.day
      ) as daily
    ), '[]'::jsonb),
    'popular_images', coalesce((
      select jsonb_agg(popular order by (popular->>'likes')::bigint desc)
      from (
        select jsonb_build_object(
          'image_key', likes.image_key,
          'content_id', max(likes.content_id::text),
          'title', max(content.title),
          'image_kind', max(likes.image_kind),
          'image_index', max(likes.image_index),
          'likes', count(*)
        ) as popular
        from public.image_likes as likes
        join public.content_management as content on content.id = likes.content_id
        group by likes.image_key
        order by count(*) desc
        limit 5
      ) as ranked
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

-- Refuse to commit if an RPC owner, SECURITY DEFINER flag, search_path or effective
-- EXECUTE ACL differs from the reviewed contract.
do $$
declare
  expected_function record;
  function_oid oid;
begin
  for expected_function in
    select *
    from (values
      ('public.record_page_view(uuid,uuid,text)', true, true, true),
      ('public.get_image_like_summary(text[],uuid)', true, true, true),
      ('public.toggle_image_like(uuid,text,integer,text,uuid)', true, true, true),
      ('public.get_admin_dashboard_stats()', true, false, true),
      ('public.nobi_storage_image_key(text)', false, false, false)
    ) as expected(signature, security_definer, anon_execute, authenticated_execute)
  loop
    function_oid := pg_catalog.to_regprocedure(expected_function.signature);

    if function_oid is null or not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = function_oid
        and procedure.prosecdef = expected_function.security_definer
        and pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
        and procedure.proconfig = array['search_path=pg_catalog']
    ) then
      raise exception 'Engagement function % has an unsafe owner or configuration',
        expected_function.signature;
    end if;

    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
        is distinct from expected_function.anon_execute
      or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
        is distinct from expected_function.authenticated_execute
    then
      raise exception 'Engagement function % has an unsafe EXECUTE ACL',
        expected_function.signature;
    end if;
  end loop;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as roles(role_name)
    cross join (values ('public.page_views'), ('public.image_likes')) as tables(table_name)
    where pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'INSERT')
      or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'UPDATE')
      or pg_catalog.has_table_privilege(roles.role_name, tables.table_name, 'DELETE')
      or pg_catalog.has_any_column_privilege(roles.role_name, tables.table_name, 'INSERT')
      or pg_catalog.has_any_column_privilege(roles.role_name, tables.table_name, 'UPDATE')
  ) then
    raise exception 'A browser role can directly mutate an engagement table';
  end if;

  if exists (
    select 1
    from (values ('public.page_views'), ('public.image_likes')) as tables(table_name)
    join pg_catalog.pg_class as class on class.oid = tables.table_name::regclass
    where not class.relrowsecurity
  ) then
    raise exception 'An engagement table does not have RLS enabled';
  end if;
end
$$;

-- The primary key (post_id, user_id) already supports post_id-leading lookups.
-- Add a user_id-leading index only when no equivalent plain index already exists.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = index_row.indrelid
      and attribute.attname = 'user_id'
    where index_row.indrelid = 'public.post_likes'::regclass
      and index_row.indpred is null
      and index_row.indexprs is null
      and index_row.indnkeyatts = 1
      and index_row.indkey[0] = attribute.attnum
  ) then
    create index post_likes_user_id_idx on public.post_likes (user_id);
  end if;
end
$$;

-- The production preflight must confirm that site_config.section is unique.
-- Existing operational values are never updated by a migration rerun.
insert into public.site_config (section, url)
select 'features_v2', '{"analytics":true,"imageLikes":true}'
where not exists (
  select 1
  from public.site_config as config
  where config.section = 'features_v2'
);

commit;
