import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609290001_profiles_update_rls_corrective.sql', import.meta.url);
const verifyUrl = new URL('../supabase/verify_profiles_update_rls.sql', import.meta.url);

describe('Phase 4.5.2 profile owner UPDATE boundary', () => {
  test('preserves SELECT/INSERT policies and replaces only UPDATE policies', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain("where schemaname = 'public' and tablename = 'profiles' and cmd = 'update'");
    expect(sql).not.toMatch(/drop\s+policy[^;]+(?:select|insert)/);
    expect(sql).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.profiles/);
  });

  test('binds both UPDATE expressions to auth.uid and limits editable columns', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('to authenticated\nusing (auth.uid() = id)\nwith check (auth.uid() = id)');
    expect(sql).toContain('grant update (nickname, avatar_url, avatar) on table public.profiles to authenticated');
    expect(sql).toContain("has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'update')");
  });

  test('ships a read-only verification for policy and privilege drift', async () => {
    const sql = (await readFile(verifyUrl, 'utf8')).toLowerCase();
    expect(sql).toContain("qual = '(auth.uid() = id)'");
    expect(sql).toContain("with_check = '(auth.uid() = id)'");
    expect(sql).toContain("has_any_column_privilege('anon', 'public.profiles', 'update')");
    expect(sql).not.toMatch(/\b(?:insert|update|delete|drop|alter|grant|revoke|create)\b\s+(?:on|into|table|policy)/);
  });
});
