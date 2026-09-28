-- Transactional A/B authorization matrix. Run only after verify_posts_security_baseline.sql passes.
-- Requires two existing non-admin auth.users rows. Every mutation is rolled back.
begin;

create temporary table posts_security_test_context on commit drop as
with candidates as (
  select id
  from auth.users
  where id not in (select id from public.profiles where coalesce(is_admin, false))
  order by id
  limit 2
)
select
  (pg_catalog.array_agg(id order by id))[1] as user_a,
  (pg_catalog.array_agg(id order by id))[2] as user_b,
  null::bigint as post_a,
  null::bigint as post_b
from candidates;

do $require_two_users$
begin
  if (select user_a is null or user_b is null or user_a = user_b from posts_security_test_context) then
    raise exception 'Posts security test requires two distinct non-admin auth users';
  end if;
end;
$require_two_users$;

grant select, update on table posts_security_test_context to authenticated;

select pg_catalog.set_config('request.jwt.claim.sub', user_a::text, true)
from posts_security_test_context;
set local role authenticated;

with inserted as (
  insert into public.posts (user_id, content, nickname, title, category, parent_id)
  select user_a, 'security test A', 'security-test-a', 'security test A', 'test', null
  from posts_security_test_context
  returning id
)
update posts_security_test_context set post_a = inserted.id from inserted;

insert into public.posts (user_id, content, nickname, parent_id)
select user_a, 'security test reply A', 'security-test-a', post_a
from posts_security_test_context;

do $owner_update_allowed$
declare
  changed bigint;
begin
  update public.posts
  set content = 'security test A updated'
  where id = (select post_a from posts_security_test_context);
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'FAIL: A could not update own post'; end if;
end;
$owner_update_allowed$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', user_b::text, true)
from posts_security_test_context;
set local role authenticated;

with inserted as (
  insert into public.posts (user_id, content, nickname, title, category, parent_id)
  select user_b, 'security test B', 'security-test-b', 'security test B', 'test', null
  from posts_security_test_context
  returning id
)
update posts_security_test_context set post_b = inserted.id from inserted;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $anon_denials$
declare
  denied boolean := false;
begin
  begin
    insert into public.posts (content) values ('anon security test');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: anon INSERT succeeded'; end if;

  denied := false;
  begin
    update public.posts set content = 'anon update';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: anon UPDATE succeeded'; end if;
end;
$anon_denials$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', user_a::text, true)
from posts_security_test_context;
set local role authenticated;

do $user_a_denials$
declare
  denied boolean;
  changed bigint;
begin
  denied := false;
  begin
    insert into public.posts (user_id, content)
    select user_b, 'forged owner' from posts_security_test_context;
  exception when insufficient_privilege or check_violation then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: A created a post owned by B'; end if;

  update public.posts set content = 'cross-user update'
  where id = (select post_b from posts_security_test_context);
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: A updated B post'; end if;

  denied := false;
  begin
    update public.posts
    set user_id = (select user_b from posts_security_test_context)
    where id = (select post_a from posts_security_test_context);
  exception when insufficient_privilege or check_violation then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: A changed post owner'; end if;

  denied := false;
  begin
    update public.posts set id = id where id = (select post_a from posts_security_test_context);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: A updated id'; end if;

  denied := false;
  begin
    update public.posts set created_at = created_at where id = (select post_a from posts_security_test_context);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: A updated created_at'; end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'likes_users'
  ) then
    denied := false;
    begin
      execute 'update public.posts set likes_users = likes_users where id = $1'
      using (select post_a from posts_security_test_context);
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'FAIL: A updated likes_users'; end if;
  end if;
end;
$user_a_denials$;

select * from public.toggle_post_like(
  (select post_a from posts_security_test_context),
  false
);
select public.report_post(
  (select post_b from posts_security_test_context),
  'spam',
  'posts security baseline transactional test'
);
select public.set_user_block((select user_b from posts_security_test_context), true);
select public.set_user_block((select user_b from posts_security_test_context), false);

reset role;
select 'PASS' as authorization_matrix_status;

rollback;
