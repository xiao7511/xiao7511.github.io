import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useAuthStore } from './auth';
import { fetchAdminStatus } from '../services/admin';
import { getSupabase } from '../services/supabase';

vi.mock('../services/supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('../services/admin', () => ({ fetchAdminStatus: vi.fn() }));
vi.mock('../services/auth', () => ({ authErrorMessage: () => 'safe auth error', restoreAuthSession: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function session(userId: string): Session {
  return {
    access_token: 'test-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4_000_000_000,
    refresh_token: 'test-refresh',
    user: { id: userId, email: `${userId}@nobi.test` }
  } as Session;
}

describe('authenticated profile lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test('a late previous-account profile response cannot replace the current account', async () => {
    const results = new Map<string, ReturnType<typeof deferred<{ data: unknown; error: null }>>>();
    const maybeSingle = vi.fn(() => results.get(currentId)!.promise);
    let currentId = '';
    const client = {
      auth: {
        signInWithPassword: vi.fn(async ({ email }: { email: string }) => ({
          data: { session: session(email.split('@')[0]) },
          error: null
        })),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_column: string, id: string) => {
            currentId = id;
            if (!results.has(id)) results.set(id, deferred());
            return { maybeSingle };
          })
        }))
      }))
    } as unknown as SupabaseClient;
    vi.mocked(getSupabase).mockResolvedValue(client);
    vi.mocked(fetchAdminStatus).mockResolvedValue(false);

    const auth = useAuthStore();
    const loginA = auth.signIn('user-a@nobi.test', 'password');
    await vi.waitFor(() => expect(results.has('user-a')).toBe(true));
    const loginB = auth.signIn('user-b@nobi.test', 'password');
    await vi.waitFor(() => expect(results.has('user-b')).toBe(true));

    expect(auth.profile).toBeNull();
    results.get('user-b')!.resolve({ data: { id: 'user-b', nickname: 'B', avatar_url: null }, error: null });
    await loginB;
    results.get('user-a')!.resolve({ data: { id: 'user-a', nickname: 'A', avatar_url: 'old-avatar' }, error: null });
    await loginA;

    expect(auth.user?.id).toBe('user-b');
    expect(auth.profile).toMatchObject({ id: 'user-b', nickname: 'B' });
  });

  test('logout immediately clears profile and administrator state', async () => {
    const client = {
      auth: { signOut: vi.fn().mockResolvedValue({ error: null }) }
    } as unknown as SupabaseClient;
    vi.mocked(getSupabase).mockResolvedValue(client);
    const auth = useAuthStore();
    auth.session = session('user-a');
    auth.user = auth.session.user;
    auth.profile = { id: 'user-a', nickname: 'A', avatar_url: null };
    auth.isAdmin = true;

    await auth.signOut();

    expect(auth.user).toBeNull();
    expect(auth.profile).toBeNull();
    expect(auth.profileStatus).toBe('idle');
    expect(auth.isAdmin).toBe(false);
  });

  test('a late administrator result cannot authorize a switched non-admin account', async () => {
    const adminA = deferred<boolean>();
    vi.mocked(fetchAdminStatus)
      .mockReturnValueOnce(adminA.promise)
      .mockResolvedValueOnce(false);
    const client = profileClient();
    vi.mocked(getSupabase).mockResolvedValue(client);
    const auth = useAuthStore();

    const loginA = auth.signIn('user-a@nobi.test', 'password');
    await vi.waitFor(() => expect(fetchAdminStatus).toHaveBeenCalledTimes(1));
    await auth.signIn('user-b@nobi.test', 'password');
    expect(auth.user?.id).toBe('user-b');
    expect(auth.isAdmin).toBe(false);

    adminA.resolve(true);
    await loginA;
    expect(auth.user?.id).toBe('user-b');
    expect(auth.isAdmin).toBe(false);
  });

  test('a late non-admin result cannot revoke the switched admin account', async () => {
    const adminA = deferred<boolean>();
    vi.mocked(fetchAdminStatus)
      .mockReturnValueOnce(adminA.promise)
      .mockResolvedValueOnce(true);
    const client = profileClient();
    vi.mocked(getSupabase).mockResolvedValue(client);
    const auth = useAuthStore();

    const loginA = auth.signIn('user-a@nobi.test', 'password');
    await vi.waitFor(() => expect(fetchAdminStatus).toHaveBeenCalledTimes(1));
    await auth.signIn('user-b@nobi.test', 'password');
    expect(auth.user?.id).toBe('user-b');
    expect(auth.isAdmin).toBe(true);

    adminA.resolve(false);
    await loginA;
    expect(auth.user?.id).toBe('user-b');
    expect(auth.isAdmin).toBe(true);
  });

  test('a late administrator result cannot restore authorization after logout', async () => {
    const adminA = deferred<boolean>();
    vi.mocked(fetchAdminStatus).mockReturnValueOnce(adminA.promise);
    const client = profileClient();
    vi.mocked(getSupabase).mockResolvedValue(client);
    const auth = useAuthStore();

    const loginA = auth.signIn('user-a@nobi.test', 'password');
    await vi.waitFor(() => expect(fetchAdminStatus).toHaveBeenCalledTimes(1));
    await auth.signOut();
    adminA.resolve(true);
    await loginA;

    expect(auth.user).toBeNull();
    expect(auth.profile).toBeNull();
    expect(auth.isAdmin).toBe(false);
  });

  test('missing database provisioning is distinct while authentication remains usable', async () => {
    const client = {
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { session: session('user-a') }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) }))
      }))
    } as unknown as SupabaseClient;
    vi.mocked(getSupabase).mockResolvedValue(client);
    vi.mocked(fetchAdminStatus).mockResolvedValue(false);

    const auth = useAuthStore();
    await expect(auth.signIn('user-a@nobi.test', 'password')).resolves.toBeUndefined();

    expect(auth.user?.id).toBe('user-a');
    expect(auth.profile).toBeNull();
    expect(auth.profileStatus).toBe('missing');
    expect(auth.error).toBeNull();
  });
});

function profileClient(): SupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn(async ({ email }: { email: string }) => ({
        data: { session: session(email.split('@')[0]) },
        error: null
      })),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, id: string) => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id, nickname: id, avatar_url: null },
            error: null
          })
        }))
      }))
    }))
  } as unknown as SupabaseClient;
}
