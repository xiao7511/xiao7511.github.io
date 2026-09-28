import fs from 'node:fs';
import { describe, expect, test } from 'vitest';

const migration = fs
  .readFileSync(new URL('../supabase/migrations/20260927000130_posts_security_baseline.sql', import.meta.url), 'utf8')
  .toLowerCase();
const preflight = fs
  .readFileSync(new URL('../supabase/posts_security_preflight.sql', import.meta.url), 'utf8')
  .toLowerCase();
const verify = fs
  .readFileSync(new URL('../supabase/verify_posts_security_baseline.sql', import.meta.url), 'utf8')
  .toLowerCase();
const mobileCommunity = fs.readFileSync(new URL('../mobile/src/services/community.ts', import.meta.url), 'utf8');
const webLikes = fs.readFileSync(new URL('../public/assets/js/src/community/likes.js', import.meta.url), 'utf8');

describe('production posts security baseline', () => {
  test('enables RLS, removes all client writes, and grants only the editor columns', () => {
    expect(migration).toContain('alter table public.posts enable row level security');
    expect(migration).toContain('alter table public.posts no force row level security');
    expect(migration).not.toContain('alter table public.posts force row level security');
    expect(migration).toContain('revoke insert, update on table public.posts from public, anon, authenticated');
    expect(migration).toContain("array['public', 'anon', 'authenticated']");
    expect(migration).toContain('grant insert (user_id, content, nickname, avatar_url, title, category, parent_id)');
    expect(migration).toContain('grant update (content, nickname, avatar_url, title, category)');
    expect(migration).not.toMatch(/grant\s+(?:insert|update)[^;]*likes_users/);
  });

  test('replaces permissive writes with strict owner policies', () => {
    expect(migration).toContain("policy.cmd in ('all', 'insert', 'update')");
    expect(migration).toContain('with check (user_id = auth.uid())');
    expect(migration).toContain('using (user_id = auth.uid())');
    expect(verify).toContain('extra_permissive_write_policy');
    expect(verify).toContain("then 'fail' else 'pass'");
  });

  test('keeps likes on the normalized RPC path and inventories compatibility', () => {
    expect(mobileCommunity).toContain("client.rpc('toggle_post_like'");
    expect(webLikes).toContain("client.rpc('toggle_post_like'");
    expect(preflight).toContain('public.toggle_post_like(bigint,boolean)');
    expect(preflight).toContain('likes_users_dependencies');
    expect(verify).toContain('post_likes_rls');
    expect(verify).toContain('moderation_rpc');
  });
});
