import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609290001_profiles_update_rls_corrective.sql', import.meta.url);
const verifyUrl = new URL('../supabase/verify_profiles_update_rls.sql', import.meta.url);

async function readSql(url) {
  return (await readFile(url, 'utf8')).replace(/\r\n?/g, '\n').toLowerCase();
}

describe('Phase 4.5.2 profile owner UPDATE boundary', () => {
  test('preserves SELECT/INSERT policies and replaces only UPDATE policies', async () => {
    const sql = await readSql(migrationUrl);
    expect(sql).toContain("where schemaname = 'public' and tablename = 'profiles' and cmd = 'update'");
    expect(sql).not.toMatch(/drop\s+policy[^;]+(?:select|insert)/);
    expect(sql).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.profiles/);
  });

  test('binds both UPDATE expressions to auth.uid and limits editable columns', async () => {
    const sql = await readSql(migrationUrl);
    expect(sql).toContain('create policy "profiles own update"\non public.profiles\nfor update');
    expect(sql).toContain('to authenticated\nusing (auth.uid() = id)\nwith check (auth.uid() = id)');
    expect(sql).toContain('grant update (nickname, avatar_url) on table public.profiles to authenticated');
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'id', 'update')");
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update')");
    expect(sql).not.toMatch(/'avatar'|'is_admin'/);
  });

  test('matches the real production profile schema and revokes every prior UPDATE grant', async () => {
    const sql = await readSql(migrationUrl);
    for (const column of ['id', 'created_at', 'nickname', 'avatar_url']) {
      expect(sql).toContain(`'${column}'`);
    }
    expect(sql).toContain('revoke update on table public.profiles from public, anon, authenticated');
    expect(sql).toContain("'revoke update (%s) on table public.profiles from public, anon, authenticated'");
    expect(sql).toMatch(/^--[^\n]*\nbegin;/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
  });

  test('ships a read-only verification for policy and privilege drift', async () => {
    const sql = await readSql(verifyUrl);
    expect(sql).toContain("qual = '(auth.uid() = id)'");
    expect(sql).toContain("with_check = '(auth.uid() = id)'");
    expect(sql).toContain("has_any_column_privilege('anon', 'public.profiles', 'update')");
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update')");
    expect(sql).toContain("grantee in ('public', 'anon')");
    expect(sql).not.toMatch(/'avatar'|'is_admin'/);
    expect(sql).not.toMatch(/\b(?:insert|update|delete|drop|alter|grant|revoke|create)\b\s+(?:on|into|table|policy)/);
  });
});
