import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { requestAccountDeletion } from './account';

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe('account deletion request', () => {
  test('returns the server timestamp from the trusted RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: '2026-09-27T10:00:00.000Z', error: null });

    await expect(requestAccountDeletion(clientWithRpc(rpc))).resolves.toBe('2026-09-27T10:00:00.000Z');
    expect(rpc).toHaveBeenCalledWith('request_account_deletion');
  });

  test('rejects RPC errors and malformed responses', async () => {
    const failure = new Error('RLS');
    await expect(
      requestAccountDeletion(clientWithRpc(vi.fn().mockResolvedValue({ data: null, error: failure })))
    ).rejects.toBe(failure);
    await expect(
      requestAccountDeletion(clientWithRpc(vi.fn().mockResolvedValue({ data: 'not-a-date', error: null })))
    ).rejects.toThrow('INVALID_DELETION_RESPONSE');
  });
});
