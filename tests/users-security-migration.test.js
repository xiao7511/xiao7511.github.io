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
    expect(sql).toContain('set search_path = pg_catalog, public');
    expect(sql).toMatch(/begin\s+if not public\.is_admin\(\) then/);
    expect(sql).toContain("pg_catalog.hashtextextended('nobi:set_user_admin', 0)");
    expect(sql).toContain('At least one administrator must remain');
    expect(sql).toContain(
      'revoke all on function public.set_user_admin(uuid, boolean) from public, anon, authenticated'
    );
    expect(sql).toContain('grant execute on function public.set_user_admin(uuid, boolean) to authenticated');
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
    expect(sql).toContain('can_execute_set_user_admin');
    expect(sql).toContain('pg_catalog.pg_get_triggerdef');
  });
});
