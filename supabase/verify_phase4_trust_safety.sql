-- Read-only verification for the Phase 4 trust/safety migration.
select pg_class.relname as table_name, pg_class.relrowsecurity as row_security
from pg_catalog.pg_class
join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relname in ('user_blocks', 'post_reports', 'moderation_actions', 'account_deletion_requests')
order by pg_class.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('posts', 'user_blocks', 'post_reports', 'moderation_actions', 'account_deletion_requests')
order by tablename, policyname;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'report_post',
    'set_user_block',
    'request_account_deletion',
    'cancel_account_deletion_request',
    'review_post_report'
  )
order by routine_name;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('user_blocks', 'post_reports', 'moderation_actions', 'account_deletion_requests')
order by table_name, grantee, privilege_type;
