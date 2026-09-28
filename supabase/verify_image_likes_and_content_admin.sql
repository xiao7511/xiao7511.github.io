-- Phase 4.5.1 verification. READ ONLY. Returns PASS only for the reviewed contract.
with issues as (
  select 'CONTENT_ACTIVE_COLUMN'::text as code
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'content_management' and column_name = 'is_active'
      and data_type = 'boolean' and is_nullable = 'NO' and column_default in ('true', 'true::boolean')
  )
  union all
  select 'CONTENT_RLS' where not exists (
    select 1 from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.content_management') and relrowsecurity
  )
  union all
  select 'CONTENT_ADMIN_POLICY' where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'content_management'
      and cmd = 'ALL' and roles @> array['authenticated']::name[]
      and coalesce(qual, '') ilike '%is_admin()%'
      and coalesce(with_check, '') ilike '%is_admin()%'
  )
  union all
  select 'IMAGE_LIKES_RLS' where not exists (
    select 1 from pg_catalog.pg_class where oid = pg_catalog.to_regclass('public.image_likes') and relrowsecurity
  )
  union all
  select 'IMAGE_LIKES_DIRECT_WRITE' where exists (
    select 1 from (values ('anon'), ('authenticated')) as role(role_name)
    where pg_catalog.has_table_privilege(role.role_name, 'public.image_likes', 'INSERT')
      or pg_catalog.has_table_privilege(role.role_name, 'public.image_likes', 'UPDATE')
      or pg_catalog.has_table_privilege(role.role_name, 'public.image_likes', 'DELETE')
      or pg_catalog.has_any_column_privilege(role.role_name, 'public.image_likes', 'INSERT,UPDATE')
  )
  union all
  select 'IMAGE_LIKES_USER_UNIQUE' where not exists (
    select 1 from pg_catalog.pg_index as index_row
    join pg_catalog.pg_class as index_class on index_class.oid = index_row.indexrelid
    where index_row.indrelid = pg_catalog.to_regclass('public.image_likes') and index_row.indisunique
      and index_class.relname = 'image_likes_user_unique_idx'
      and pg_catalog.pg_get_indexdef(index_row.indexrelid) like '%(image_key, user_id)%'
  )
  union all
  select 'SUMMARY_RPC_ACL' where
    pg_catalog.to_regprocedure('public.get_image_like_summary(text[],uuid)') is null
    or not pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.get_image_like_summary(text[],uuid)'), 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.get_image_like_summary(text[],uuid)'), 'EXECUTE')
  union all
  select 'TOGGLE_RPC_ACL' where
    pg_catalog.to_regprocedure('public.toggle_image_like(uuid,text,integer,text,uuid)') is null
    or pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.toggle_image_like(uuid,text,integer,text,uuid)'), 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.toggle_image_like(uuid,text,integer,text,uuid)'), 'EXECUTE')
  union all
  select 'TOGGLE_RPC_SECURITY' where not exists (
    select 1 from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.toggle_image_like(uuid,text,integer,text,uuid)')
      and prosecdef and proconfig = array['search_path=pg_catalog']
      and pg_catalog.pg_get_userbyid(proowner) = 'postgres'
      and pg_catalog.pg_get_functiondef(oid) ilike '%current_user_id is null%Authentication required%'
      and pg_catalog.pg_get_functiondef(oid) not ilike '%anonymous:%'
  )
  union all
  select 'CONTENT_ORDER_RPC' where not exists (
    select 1 from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.save_home_content_order(text,jsonb)')
      and prosecdef and proconfig = array['search_path=pg_catalog']
      and pg_catalog.pg_get_userbyid(proowner) = 'postgres'
      and pg_catalog.pg_get_functiondef(oid) ilike '%public.is_admin()%'
  ) or pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.save_home_content_order(text,jsonb)'), 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.save_home_content_order(text,jsonb)'), 'EXECUTE')
  union all
  select 'ADMIN_STATS' where not exists (
    select 1 from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.get_admin_dashboard_stats()')
      and prosecdef and proconfig = array['search_path=pg_catalog']
      and pg_catalog.pg_get_userbyid(proowner) = 'postgres'
      and pg_catalog.pg_get_functiondef(oid) ilike '%today_image_likes%popular_images%limit 5%'
  )
)
select case when exists (select 1 from issues) then 'FAIL' else 'PASS' end as verification,
  coalesce((select jsonb_agg(to_jsonb(issue)) from issues as issue), '[]'::jsonb) as findings;
