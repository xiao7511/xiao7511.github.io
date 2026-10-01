-- Provide Admin user management a narrow RLS-safe read boundary.
begin;

create or replace function public.list_admin_users()
returns table (
  id uuid,
  email text,
  is_admin boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
    select users.id, users.email, users.is_admin, users.created_at
    from public.users as users
    order by users.created_at desc nulls last, users.id;
end;
$$;

revoke all on function public.list_admin_users() from public, anon, authenticated;
grant execute on function public.list_admin_users() to authenticated;

commit;
