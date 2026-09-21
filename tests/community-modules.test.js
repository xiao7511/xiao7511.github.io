import { describe, expect, test, vi } from 'vitest';
import { groupLikesByPostId } from '../public/assets/js/src/community/posts.js';
import { togglePostLike } from '../public/assets/js/src/community/likes.js';
import { summarizeAccessToken } from '../public/assets/js/src/auth/session.js';
import { initializeSupabase } from '../public/assets/js/src/api/supabase.js';

function accessToken({
  sub = 'verified-user',
  role = 'authenticated',
  exp = Math.floor(Date.now() / 1000) + 3600
} = {}) {
  const payload = btoa(JSON.stringify({ sub, role, exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `test.${payload}.signature`;
}

function session(userId = 'verified-user', token = accessToken({ sub: userId })) {
  return { user: { id: userId }, access_token: token };
}

describe('community likes modules', () => {
  test('shares one Supabase client across concurrent page initializers', async () => {
    const createdClient = { id: 'shared-client' };
    const createClient = vi.fn(() => createdClient);
    globalThis.window = { supabase: { createClient } };
    const config = { SUPABASE_URL: 'https://supabase.example', ANON_KEY: 'test-public-key' };
    const [mainClient, v2Client] = await Promise.all([initializeSupabase(config), initializeSupabase(config)]);
    expect(mainClient).toBe(createdClient);
    expect(v2Client).toBe(createdClient);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  test('groups user ids by bigint post id', () => {
    const groups = groupLikesByPostId([
      { post_id: 10, user_id: 'user-a' },
      { post_id: 10, user_id: 'user-b' },
      { post_id: 11, user_id: 'user-a' }
    ]);
    expect(groups.get(10)).toEqual(['user-a', 'user-b']);
    expect(groups.get(11)).toEqual(['user-a']);
  });

  test('inserts using the current authenticated session user id', async () => {
    const calls = [];
    const client = {
      auth: { getSession: async () => ({ data: { session: session() }, error: null }) },
      from: (table) => ({
        insert: (payload) => {
          calls.push({ table, payload });
          return Promise.resolve({ error: null });
        }
      })
    };
    const result = await togglePostLike(client, { postId: 42, isLiked: false });
    expect(result.authenticated).toBe(true);
    expect(calls).toEqual([{ table: 'post_likes', payload: { post_id: 42, user_id: 'verified-user' } }]);
  });

  test('deletes only the current session user reaction', async () => {
    const filters = [];
    const query = {
      eq(column, value) {
        filters.push([column, value]);
        return this;
      },
      then(resolve) {
        resolve({ error: null });
      }
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: session('user-a') }, error: null }) },
      from: () => ({ delete: () => query })
    };
    await togglePostLike(client, { postId: 42, isLiked: true });
    expect(filters).toEqual([
      ['post_id', 42],
      ['user_id', 'user-a']
    ]);
  });

  test('does not send a post_likes request without an auth session', async () => {
    const from = vi.fn();
    const client = {
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
      from
    };
    await expect(togglePostLike(client, { postId: 42, isLiked: false })).resolves.toEqual({
      authenticated: false,
      reason: 'expired'
    });
    expect(from).not.toHaveBeenCalled();
  });

  test('refreshes an invalid stored token before sending one write', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const refreshSession = vi.fn(async () => ({ data: { session: session() }, error: null }));
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: session('verified-user', accessToken({ sub: '' })) },
          error: null
        }),
        refreshSession
      },
      from: () => ({ insert })
    };
    await expect(togglePostLike(client, { postId: 42, isLiked: false })).resolves.toMatchObject({
      authenticated: true
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  test('refreshes and retries a bad_jwt database response at most once', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: 'bad_jwt', message: 'invalid claim: missing sub claim' } })
      .mockResolvedValueOnce({ error: null });
    const refreshSession = vi.fn(async () => ({ data: { session: session() }, error: null }));
    const client = {
      auth: {
        getSession: async () => ({ data: { session: session() }, error: null }),
        refreshSession
      },
      from: () => ({ insert })
    };
    await expect(togglePostLike(client, { postId: 42, isLiked: false })).resolves.toMatchObject({
      authenticated: true
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  test('stops after one failed refresh and requires login again', async () => {
    const insert = vi.fn(async () => ({
      error: { code: 'bad_jwt', message: 'invalid claim: missing sub claim' }
    }));
    const refreshSession = vi.fn(async () => ({ data: { session: null }, error: { message: 'refresh failed' } }));
    const client = {
      auth: {
        getSession: async () => ({ data: { session: session() }, error: null }),
        refreshSession
      },
      from: () => ({ insert })
    };
    await expect(togglePostLike(client, { postId: 42, isLiked: false })).resolves.toEqual({
      authenticated: false,
      reason: 'expired'
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  test('summarizes JWT claims without exposing the token', () => {
    expect(summarizeAccessToken(accessToken())).toMatchObject({
      hasSub: true,
      role: 'authenticated'
    });
    expect(summarizeAccessToken(accessToken({ sub: '', role: 'anon' }))).toMatchObject({
      hasSub: false,
      role: 'anon'
    });
  });
});
