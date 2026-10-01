import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import {
  deleteAdminHomeContent,
  fetchAdminHomeContent,
  fetchAdminStatus,
  fetchAdminUsers,
  reviewReport,
  fetchAdminSocialLinks,
  saveAdminSocialLinks,
  saveAdminHomeContent,
  setAdminState
} from './admin';
import type { ContentItem } from '../types/content';
import { parseSocialSettings } from './social-links';

describe('mobile admin security services', () => {
  test('gets administrator state from is_admin RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(fetchAdminStatus({ rpc } as unknown as SupabaseClient)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_admin');
  });

  test('loads the user list through the restricted Admin RPC and merges canonical profile fields', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'user-a', email: 'a@nobi.test', is_admin: true, created_at: '2026-01-01T00:00:00Z' }],
      error: null
    });
    const inQuery = vi.fn().mockResolvedValue({ data: [{ id: 'user-a', nickname: 'A', avatar_url: 'avatar.webp' }], error: null });
    const select = vi.fn(() => ({ in: inQuery }));
    const client = { rpc, from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    await expect(fetchAdminUsers(client)).resolves.toEqual([
      {
        id: 'user-a',
        email: 'a@nobi.test',
        is_admin: true,
        created_at: '2026-01-01T00:00:00Z',
        nickname: 'A',
        avatar_url: 'avatar.webp'
      }
    ]);
    expect(rpc).toHaveBeenCalledWith('list_admin_users');
    expect(client.from).toHaveBeenCalledWith('profiles');
  });

  test('fails closed when the Admin user-list RPC is rejected', async () => {
    const error = new Error('Administrator access required');
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(fetchAdminUsers({ rpc } as unknown as SupabaseClient)).rejects.toBe(error);
  });

  test('uses the existing secure admin RPCs for mutations', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    await setAdminState(client, 'user-b', true);
    await reviewReport(client, 9, 'hide', ' confirmed ');
    expect(rpc).toHaveBeenNthCalledWith(1, 'set_user_admin', { p_user_id: 'user-b', p_is_admin: true });
    expect(rpc).toHaveBeenNthCalledWith(2, 'review_post_report', {
      p_report_id: 9,
      p_action: 'hide',
      p_note: 'confirmed'
    });
  });

  test('does not hide rejected administrator RPC calls', async () => {
    const error = new Error('Administrator access required');
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as SupabaseClient;
    await expect(setAdminState(client, 'user-b', true)).rejects.toBe(error);
    await expect(reviewReport(client, 9, 'dismiss')).rejects.toBe(error);
  });

  test('saves one complete ordered home section through the administrator RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const rows = [
      { id: 'a', category: 'anime', slot_index: 4, title: 'A', is_active: true },
      { id: 'b', category: 'anime', slot_index: 2, title: 'B', is_active: false }
    ] as ContentItem[];
    await saveAdminHomeContent({ rpc } as unknown as SupabaseClient, 'anime', rows);
    expect(rpc).toHaveBeenCalledWith('save_home_content_order', {
      p_category: 'anime',
      p_items: [
        { id: 'a', slot_index: 0, is_active: true },
        { id: 'b', slot_index: 1, is_active: false }
      ]
    });
  });

  test('blocks more than six active home items before any database call', async () => {
    const rpc = vi.fn();
    const rows = Array.from({ length: 7 }, (_, index) => ({
      id: String(index),
      category: 'anime',
      slot_index: index,
      title: String(index),
      is_active: true
    })) as ContentItem[];
    await expect(saveAdminHomeContent({ rpc } as unknown as SupabaseClient, 'anime', rows)).rejects.toThrow(
      'ACTIVE_CONTENT_LIMIT'
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  test('loads ordered category rows and deletes only inside the selected category', async () => {
    const rows = [
      { id: 'b', category: 'anime', slot_index: 1, title: 'B' },
      { id: 'a', category: 'anime', slot_index: 0, title: 'A' }
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const selectEq = vi.fn(() => ({ order }));
    const deleteResult = Promise.resolve({ data: null, error: null });
    const deleteCategoryEq = vi.fn(() => deleteResult);
    const deleteIdEq = vi.fn(() => ({ eq: deleteCategoryEq }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq: selectEq })),
      delete: vi.fn(() => ({ eq: deleteIdEq }))
    }));
    const client = { from } as unknown as SupabaseClient;
    await expect(fetchAdminHomeContent(client, 'anime')).resolves.toEqual([rows[1], rows[0]]);
    await deleteAdminHomeContent(client, 'anime', 'a');
    expect(selectEq).toHaveBeenCalledWith('category', 'anime');
    expect(order).toHaveBeenCalledWith('slot_index');
    expect(deleteIdEq).toHaveBeenCalledWith('id', 'a');
    expect(deleteCategoryEq).toHaveBeenCalledWith('category', 'anime');
  });

  test('uses the shared site_config social_links contract and preserves unrelated settings', async () => {
    const configured = {
      twitter: 'https://twitter.com/nobi',
      _enabled: { twitter: true, custom: 'preserved' },
      _order: ['twitter'],
      another_setting: { keep: true }
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: { url: configured }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })), upsert }));
    const client = { from } as unknown as SupabaseClient;
    const settings = await fetchAdminSocialLinks(client);
    expect(settings.find((item) => item.key === 'x')?.url).toBe(configured.twitter);
    await saveAdminSocialLinks(client, settings);
    expect(from).toHaveBeenCalledWith('site_config');
    expect(eq).toHaveBeenCalledWith('section', 'social_links');
    const [payload, options] = upsert.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(options).toEqual({ onConflict: 'section' });
    expect(payload.section).toBe('social_links');
    const saved = JSON.parse(payload.url as string);
    expect(saved.x).toBe(configured.twitter);
    expect(saved._enabled.custom).toBe('preserved');
    expect(saved.another_setting).toEqual({ keep: true });
    expect(parseSocialSettings(saved).find((item) => item.key === 'x')?.url).toBe(configured.twitter);
  });

  test('rejects unsafe social URLs before persisting', async () => {
    const upsert = vi.fn();
    const settings = parseSocialSettings({ x: 'javascript:alert(1)' });
    await expect(saveAdminSocialLinks({ from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient, settings))
      .rejects.toThrow('INVALID_SOCIAL_URL');
    expect(upsert).not.toHaveBeenCalled();
  });
});
