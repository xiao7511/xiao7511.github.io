import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202610010001_admin_user_list_rpc.sql', import.meta.url);
const verifierUrl = new URL('../supabase/verify_admin_user_list_rpc.sql', import.meta.url);
const existingSecurityMigrationUrl = new URL(
  '../supabase/migrations/202609210000_secure_users_admin_privilege.sql',
  import.meta.url
);
const adminBootstrapUrl = new URL('../public/admin.html', import.meta.url);
const adminRuntimeUrl = new URL('../public/assets/js/admin-v2.js', import.meta.url);
const mobileBannerUrl = new URL('../mobile/src/views/AdminBannersView.vue', import.meta.url);
const mobileAdminServiceUrl = new URL('../mobile/src/services/admin.ts', import.meta.url);
const mobileAdminUsersViewUrl = new URL('../mobile/src/views/AdminUsersView.vue', import.meta.url);

describe('Admin user-list read boundary', () => {
  test('defines an authenticated-only, identity-free admin RPC with a restricted return shape', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    expect(migration).toMatch(/function public\.list_admin_users\(\)/i);
    expect(migration).toMatch(
      /returns table\s*\(\s*id uuid,\s*email text,\s*is_admin boolean,\s*created_at timestamptz/i
    );
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = pg_catalog/i);
    expect(migration).toMatch(/auth\.uid\(\) is null or not public\.is_admin\(\)/i);
    expect(migration).not.toMatch(/p_user_id|p_is_admin|auth\.users|password|token|raw_user_meta_data/i);
    expect(migration).toMatch(/revoke all on function public\.list_admin_users\(\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.list_admin_users\(\) to authenticated/i);
    expect(migration).not.toMatch(/create\s+policy|grant\s+select\s+on\s+table\s+public\.users/i);
  });

  test('verifier is read-only and checks function security, grants, RLS, and existing RPCs', async () => {
    const verifier = await readFile(verifierUrl, 'utf8');
    expect(verifier).toMatch(/to_regprocedure\('public\.list_admin_users\(\)'\)/i);
    expect(verifier).toMatch(/pg_get_function_result/i);
    expect(verifier).toMatch(/prosecdef/i);
    expect(verifier).toMatch(/search_path=pg_catalog/i);
    expect(verifier).toMatch(/has_function_privilege\('anon'/i);
    expect(verifier).toMatch(/has_function_privilege\('authenticated'/i);
    expect(verifier).toMatch(/relrowsecurity/i);
    expect(verifier).toMatch(/pg_policies/i);
    expect(verifier).toMatch(/public\.is_admin\(\)/i);
    expect(verifier).toMatch(/public\.set_user_admin\(uuid,boolean\)/i);
    expect(verifier).not.toMatch(
      /\b(insert\s+into|update\s+public|delete\s+from|create\s+policy|grant\s|revoke\s|alter\s|drop\s)/i
    );
  });

  test('preserves the existing secure role mutation and last-admin protection contract', async () => {
    const existingMigration = await readFile(existingSecurityMigrationUrl, 'utf8');
    expect(existingMigration).toMatch(/create or replace function public\.set_user_admin\(/i);
    expect(existingMigration).toMatch(/if not public\.is_admin\(\) then/i);
    expect(existingMigration).toMatch(/at least one administrator must remain/i);
    expect(existingMigration).toMatch(
      /revoke all on function public\.set_user_admin\(uuid, boolean\) from public, anon, authenticated/i
    );
    expect(existingMigration).toMatch(
      /grant execute on function public\.set_user_admin\(uuid, boolean\) to authenticated/i
    );
  });

  test('Web Admin authorization uses the canonical RPC and rejects stale sessions', async () => {
    const html = await readFile(adminBootstrapUrl, 'utf8');
    const authGate = html.match(/async function verifyAdminAuth\(\)[\s\S]*?\n      }/i)?.[0] ?? '';
    expect(authGate).toMatch(/auth\.getSession\(\)/);
    expect(authGate).toMatch(/rpc\('is_admin'\)/);
    expect(authGate).toMatch(/auth\.getSession\(\)/g);
    expect(authGate).toMatch(/currentSession\?\.user\?\.id\s*!==\s*session\.user\.id/);
    expect(authGate).toMatch(/isAdmin\s*!==\s*true/);
    expect(authGate).not.toMatch(/from\(['"]users['"]\)/);
    expect(authGate).not.toMatch(/profiles\.is_admin/);
  });

  test('Mobile Admin reads users through the RPC and keeps role mutation behind set_user_admin', async () => {
    const service = await readFile(mobileAdminServiceUrl, 'utf8');
    expect(service).toMatch(/client\.rpc\('list_admin_users'\)/);
    expect(service).toMatch(/client\.rpc\('set_user_admin'/);
    expect(service).not.toMatch(/from\(['"]users['"]\)/);
  });

  test('audited Admin failure feedback does not expose backend error messages', async () => {
    const [adminRuntime, mobileBanner, mobileUsersView] = await Promise.all([
      readFile(adminRuntimeUrl, 'utf8'),
      readFile(mobileBannerUrl, 'utf8'),
      readFile(mobileAdminUsersViewUrl, 'utf8')
    ]);
    expect(adminRuntime).not.toMatch(/(?:textContent|innerText|alert)\s*=\s*[^;]*error\.message/i);
    expect(mobileBanner).toMatch(/toast\.show\('Banner 保存失败，请稍后重试。', 'error'\)/);
    expect(mobileBanner).not.toMatch(/Banner 保存失败[^\n]*\$\{cause\.message\}/);
    expect(mobileUsersView).toMatch(/用户列表加载失败，请稍后重试。/);
    expect(mobileUsersView).not.toMatch(/生产 users 读取策略/);
  });
});
