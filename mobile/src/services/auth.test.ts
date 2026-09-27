import { describe, expect, test, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { restoreAuthSession } from './auth';

function session(expiresAt: number): Session {
  return {
    access_token: 'public-test-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'not-logged',
    user: { id: 'user-1' }
  } as Session;
}

describe('auth initialization', () => {
  test('no session returns null without refresh or getUser', async () => {
    const refreshSession = vi.fn();
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), refreshSession }
    } as unknown as SupabaseClient;
    await expect(restoreAuthSession(client)).resolves.toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  test('keeps a usable session and refreshes an expired one', async () => {
    const valid = session(Math.floor(Date.now() / 1000) + 3600);
    const refreshed = session(Math.floor(Date.now() / 1000) + 7200);
    const validClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: valid }, error: null }),
        refreshSession: vi.fn()
      }
    } as unknown as SupabaseClient;
    await expect(restoreAuthSession(validClient)).resolves.toBe(valid);
    expect(validClient.auth.refreshSession).not.toHaveBeenCalled();
    const expiredClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: session(1) }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: refreshed }, error: null })
      }
    } as unknown as SupabaseClient;
    await expect(restoreAuthSession(expiredClient)).resolves.toBe(refreshed);
  });
});
