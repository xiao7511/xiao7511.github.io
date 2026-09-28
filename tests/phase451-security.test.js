import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const migrationUrl = new URL('../supabase/migrations/202609280002_image_likes_and_content_admin.sql', import.meta.url);
const verifyUrl = new URL('../supabase/verify_image_likes_and_content_admin.sql', import.meta.url);

describe('Phase 4.5.1 database security', () => {
  test('preserves existing likes while making image toggles authenticated only', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toMatch(/drop\s+table\s+(?:if\s+exists\s+)?public\.image_likes/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.image_likes\s*;/i);
    expect(sql).toContain("raise exception 'Authentication required'");
    expect(sql).toContain(
      'revoke all on function public.toggle_image_like(uuid, text, integer, text, uuid) from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.toggle_image_like(uuid, text, integer, text, uuid) to authenticated'
    );
    expect(sql).not.toContain(
      'grant execute on function public.toggle_image_like(uuid, text, integer, text, uuid) to anon'
    );
  });

  test('keeps ownership server derived and retains duplicate prevention', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    const historical = await readFile(
      new URL('../supabase/migrations/202609210001_nobi_v2_engagement.sql', import.meta.url),
      'utf8'
    );
    expect(sql).toContain('current_user_id uuid := auth.uid()');
    expect(sql).toContain('current_user_id, null');
    expect(historical).toContain('image_likes_user_unique_idx');
    expect(historical).toContain('on public.image_likes (image_key, user_id)');
  });

  test('guards content ordering and administrator statistics', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).toContain('public.save_home_content_order');
    expect(sql).toContain('if not public.is_admin()');
    expect(sql).toContain('A home section can enable at most six items');
    expect(sql).toContain("'today_image_likes'");
    expect(sql).toContain('limit 5');
  });

  test('provides a read-only PASS/FAIL verification', async () => {
    const sql = await readFile(verifyUrl, 'utf8');
    expect(sql).toContain("then 'FAIL' else 'PASS'");
    expect(sql).toContain('TOGGLE_RPC_ACL');
    expect(sql).toContain('CONTENT_ORDER_RPC');
    expect(sql).not.toMatch(/^\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/im);
  });

  test('keeps Web likes on the cover identity and sends signed-out users to login', async () => {
    const site = await readFile(new URL('../public/assets/js/src/site-v2.js', import.meta.url), 'utf8');
    const home = await readFile(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
    expect(site).toContain('if (!currentUser)');
    expect(site).toContain("window.location.assign('index.html?auth=login')");
    expect(site).toContain('p_anonymous_id: null');
    expect(home).toContain('const coverLikeKeys');
    expect(home).toContain('item.is_active !== false');
  });
});
