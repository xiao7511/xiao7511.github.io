-- Read-only verification after applying 202610020001_cinematic_media.sql.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'content_management'
      and column_name = 'video_url' and data_type = 'text' and is_nullable = 'YES'
  ) then
    raise exception 'content_management.video_url nullable text is missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.content_management'::regclass and relrowsecurity
  ) then
    raise exception 'content_management RLS must remain enabled';
  end if;
end $$;
