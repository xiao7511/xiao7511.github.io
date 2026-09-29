-- Phase 4.5.2: persist a Banner's optional link to the canonical Anime/Manga row.
-- Cover and gallery data remain exclusively on the linked content_management row.

alter table public.content_management
  add column if not exists linked_content_id uuid;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.content_management'::regclass
      and conname = 'content_management_linked_content_fk'
  ) then
    alter table public.content_management
      add constraint content_management_linked_content_fk
      foreign key (linked_content_id)
      references public.content_management(id)
      on delete set null;
  end if;
end
$migration$;

create index if not exists content_management_linked_content_idx
  on public.content_management (linked_content_id)
  where linked_content_id is not null;

comment on column public.content_management.linked_content_id is
  'Optional canonical Anime/Manga content linked from a Banner; detail fields are never duplicated.';
