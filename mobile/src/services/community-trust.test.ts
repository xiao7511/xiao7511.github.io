import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { reportPost, setUserBlock } from './community';

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe('community trust and safety RPCs', () => {
  test('normalizes report details and validates the report id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 42, error: null });

    await expect(reportPost(clientWithRpc(rpc), 7, 'harassment', '  repeated abuse  ')).resolves.toBe(42);
    expect(rpc).toHaveBeenCalledWith('report_post', {
      p_post_id: 7,
      p_reason: 'harassment',
      p_details: 'repeated abuse'
    });

    await expect(
      reportPost(clientWithRpc(vi.fn().mockResolvedValue({ data: null, error: null })), 7, 'spam', '')
    ).rejects.toThrow('INVALID_REPORT_RESPONSE');
  });

  test('requires the block RPC to echo the requested state', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await expect(setUserBlock(clientWithRpc(rpc), 'user-2', true)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('set_user_block', { p_blocked_id: 'user-2', p_blocked: true });

    await expect(
      setUserBlock(clientWithRpc(vi.fn().mockResolvedValue({ data: false, error: null })), 'user-2', true)
    ).rejects.toThrow('INVALID_BLOCK_RESPONSE');
  });
});
