-- Read-only verification for Phase 4.5.2 Banner linkage.
do $verify$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_management'
      and column_name = 'linked_content_id'
      and data_type = 'uuid'
  ) then
    raise exception 'content_management.linked_content_id uuid is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.content_management'::regclass
      and confrelid = 'public.content_management'::regclass
      and conname = 'content_management_linked_content_fk'
      and contype = 'f'
      and confdeltype = 'n'
  ) then
    raise exception 'Banner linked-content foreign key is missing or unsafe';
  end if;
end
$verify$;
