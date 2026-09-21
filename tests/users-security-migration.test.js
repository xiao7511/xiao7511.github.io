import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609210000_secure_users_admin_privilege.sql', import.meta.url);
const verificationUrl = new URL('../supabase/verify_users_security.sql', import.meta.url);
const profileSecurityUrl = new URL('../supabase/migrations/202609160001_security_hardening.sql', import.meta.url);

describe('users administrator privilege migration static contract', () => {
  test('removes every direct browser write privilege without changing SELECT', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('revoke insert, update, delete, truncate, references, trigger');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain("'revoke update (%s) on table public.users from public, anon, authenticated'");
    expect(sql).toContain("'revoke insert (%s) on table public.users from public, anon, authenticated'");
    expect(sql).not.toMatch(/revoke\s+select\s+on\s+(table\s+)?public\.users/i);
    expect(sql).not.toMatch(/grant\s+update[^;]+public\.users[^;]+authenticated/i);
  });

  test('keeps row-level updates constrained to the authenticated user', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toMatch(/for update\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = id\)\s+with check/);
    expect(sql).toContain('as restrictive');
  });

  test('leaves personal profile editing on the separately protected profiles table', async () => {
    const usersSql = await readFile(migrationUrl, 'utf8');
    const profilesSql = await readFile(profileSecurityUrl, 'utf8');
    expect(usersSql).not.toMatch(/(?:revoke|grant|alter table)\s+[^;]*public\.profiles/i);
    expect(profilesSql).toContain('grant update (nickname, avatar_url, avatar) on public.profiles to authenticated');
    expect(profilesSql).toContain('using (id = auth.uid()) with check (id = auth.uid())');
  });

  test('allows administrator changes only through a guarded definer RPC', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('create or replace function public.set_user_admin');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog');
    expect(sql).toContain("procedure.proconfig is distinct from array['search_path=pg_catalog']");
    expect(sql).toMatch(/begin\s+if not public\.is_admin\(\) then/);
    expect(sql).toContain("pg_catalog.hashtextextended('nobi:set_user_admin', 0)");
    expect(sql).toContain('At least one administrator must remain');
    expect(sql).toContain(
      'revoke all on function public.set_user_admin(uuid, boolean) from public, anon, authenticated'
    );
    expect(sql).toContain('grant execute on function public.set_user_admin(uuid, boolean) to authenticated');
  });

  test('hardens the existing registration trigger function without adding another trigger', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain("handle_function oid := pg_catalog.to_regprocedure('public.handle_new_user()')");
    expect(sql).toContain("trigger_row.tgname = 'on_auth_user_created'");
    expect(sql).toContain("pg_catalog.pg_get_triggerdef(trigger_row.oid) ilike '%AFTER INSERT%'");
    expect(sql).toContain('public.users gained an unexpected trigger');
    expect(sql).toContain('create or replace function public.handle_new_user()');
    expect(sql).toContain('insert into game.profiles (id, email)');
    expect(sql).toContain('insert into public.users (id, email, is_admin)');
    expect(sql).toContain('values (new.id, new.email, false)');
    expect(sql).toContain('revoke all on function public.handle_new_user() from public, anon, authenticated');
    expect(sql).not.toMatch(/create\s+(?:or replace\s+)?trigger/i);
    expect(sql).not.toMatch(/raw_(?:user|app)_meta_data|user_metadata/i);
  });

  test('backfills only missing mappings and enforces bidirectional completeness', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('lock table auth.users in share mode');
    expect(sql).toContain('lock table public.users in share row exclusive mode');
    expect(sql).toMatch(
      /insert into public\.users \(id, email, is_admin\)\s+select auth_user\.id, auth_user\.email, false\s+from auth\.users as auth_user\s+left join public\.users as public_user on public_user\.id = auth_user\.id\s+where public_user\.id is null/i
    );
    expect(sql).not.toMatch(/on conflict/i);
    expect(sql).toContain('auth_without_public_user');
    expect(sql).toContain('public_without_auth_user');
    expect(sql).toContain('User mapping is incomplete');
  });

  test('orders assertions, trigger hardening, backfill, verification and privilege removal atomically', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    const structuralAssertions = sql.indexOf('-- 1. Production structural assertions');
    const hardenTrigger = sql.indexOf('-- 2. Keep the existing single registration trigger');
    const backfill = sql.indexOf('-- 3. Backfill only missing permission-account mappings');
    const verifyMapping = sql.indexOf('-- 4. Mapping completeness is a transaction invariant');
    const revokeWrites = sql.indexOf('-- 5. Browser roles retain no direct write path');
    const isAdmin = sql.indexOf('-- 6. Missing application mappings');
    const adminRpc = sql.indexOf('-- 7. The only browser-callable administrator mutation path');
    const privilegeAssertions = sql.indexOf('-- 8. Refuse to commit');
    expect(sql.trimStart().startsWith('-- Secure')).toBe(true);
    expect(sql).toMatch(/begin;[\s\S]*commit;\s*$/);
    const migrationOrder = [
      structuralAssertions,
      hardenTrigger,
      backfill,
      verifyMapping,
      revokeWrites,
      isAdmin,
      adminRpc,
      privilegeAssertions
    ];
    expect(migrationOrder).toEqual([...migrationOrder].sort((a, b) => a - b));
    expect(structuralAssertions).toBeGreaterThan(-1);
  });

  test('fails closed if is_admin UPDATE or users INSERT remains reachable', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain("columns.column_name,\n          'INSERT'");
    expect(sql).toContain("columns.column_name,\n          'UPDATE'");
    expect(sql).toContain("columns.column_name,\n          'REFERENCES'");
    expect(sql).toContain('A public.users column write privilege is still reachable by a browser role');
    expect(sql).toContain('A dangerous public.users table privilege is still reachable by a browser role');
  });

  test('keeps verification SQL read-only and checks effective ACLs', async () => {
    const sql = await readFile(verificationUrl, 'utf8');
    const executableSql = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executableSql).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
    expect(sql).toContain('can_update_is_admin');
    expect(sql).toContain("('handle_new_user', 'public.handle_new_user()')");
    expect(sql).toContain("('is_admin', 'public.is_admin()')");
    expect(sql).toContain("('set_user_admin', 'public.set_user_admin(uuid,boolean)')");
    expect(sql).toContain('pg_catalog.pg_get_triggerdef');
    expect(sql).toContain('auth_users_count');
    expect(sql).toContain('public_users_count');
    expect(sql).toContain('matched_users');
    expect(sql).toContain('auth_without_public_user');
    expect(sql).toContain('public_without_auth_user');
    expect(sql).toContain("pg_catalog.pg_get_functiondef('public.handle_new_user()'::regprocedure)");
  });
});
