import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

async function source(relative: string): Promise<string> {
  return readFile(new URL(relative, import.meta.url), 'utf8');
}

describe('Phase 4.5 profile and admin UI', () => {
  test('profile exposes a constrained image picker and administrator-only route', async () => {
    const profile = await source('../views/ProfileView.vue');
    expect(profile).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(profile).toContain('v-if="auth.isAdmin"');
    expect(profile).toContain('to="/admin"');
  });

  test('admin screens use existing secure RPC and content contracts', async () => {
    const service = await source('./admin.ts');
    expect(service).toContain("rpc('is_admin')");
    expect(service).toContain("rpc('set_user_admin'");
    expect(service).toContain("rpc('review_post_report'");
    expect(service).toContain("from('content_management')");
  });

  test('avatar migration binds writes to auth.uid and keeps the legacy Web path compatible', async () => {
    const sql = await source('../../../supabase/migrations/202609280001_avatar_storage_security.sql');
    expect(sql).toContain("bucket_id = 'avatars'");
    expect(sql).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(sql).toContain("name ~ ('^' || auth.uid()::text");
    expect(sql).toContain("tablename = 'profiles'");
    expect(sql).toContain("coalesce(with_check, '') ilike '%id%auth.uid()%'");
  });

  test('avatar preflight and verification are read-only and enforce the same ownership baseline', async () => {
    const preflight = await source('../../../supabase/avatar_storage_preflight.sql');
    const verify = await source('../../../supabase/verify_avatar_storage_security.sql');
    expect(preflight).not.toMatch(
      /\b(insert into|update public|delete from|alter table|create policy|drop policy|grant |revoke )/i
    );
    expect(preflight).toContain('SAFE TO MIGRATE');
    expect(preflight).toContain('PROFILE_OWNER_UPDATE_POLICY');
    expect(verify).toContain("then 'FAIL' else 'PASS'");
    expect(verify).toContain('PROFILE_OWNER_UPDATE_POLICY');
  });
});
