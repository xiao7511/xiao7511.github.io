import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import type { ContentItem } from '../types/content';
import { contentCoverLikeTarget, fetchImageLikeSummaries, toggleContentImageLike } from './image-likes';

const item: ContentItem = {
  id: '80ad5b9d-a442-4fe5-b156-f8c79310aa11',
  category: 'anime',
  slot_index: 0,
  title: 'NOBI',
  cover_url: 'https://project.supabase.co/storage/v1/object/public/images/nobi.webp?v=3'
};

describe('content image likes', () => {
  test('uses one stable cover key across Home, List and Detail', () => {
    expect(contentCoverLikeTarget(item)).toEqual({
      contentId: item.id,
      imageKey: 'images/nobi.webp',
      kind: 'cover',
      index: 0
    });
  });

  test('allows anonymous summary reads without an anonymous actor id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ image_key: 'images/nobi.webp', like_count: 12, liked: false }],
      error: null
    });
    const result = await fetchImageLikeSummaries({ rpc } as unknown as SupabaseClient, [item]);
    expect(rpc).toHaveBeenCalledWith('get_image_like_summary', {
      p_image_keys: ['images/nobi.webp'],
      p_anonymous_id: null
    });
    expect(result.get('images/nobi.webp')).toEqual({ count: 12, liked: false });
  });

  test('toggles through the existing RPC without accepting a client user id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ liked: true, like_count: 13 }], error: null });
    await expect(
      toggleContentImageLike({ rpc } as unknown as SupabaseClient, contentCoverLikeTarget(item)!)
    ).resolves.toEqual({ liked: true, count: 13 });
    expect(rpc).toHaveBeenCalledWith('toggle_image_like', {
      p_content_id: item.id,
      p_image_kind: 'cover',
      p_image_index: 0,
      p_image_key: 'images/nobi.webp',
      p_anonymous_id: null
    });
  });

  test('propagates unauthenticated and duplicate protection errors from the RPC', async () => {
    const error = new Error('Authentication required');
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(
      toggleContentImageLike({ rpc } as unknown as SupabaseClient, contentCoverLikeTarget(item)!)
    ).rejects.toBe(error);
  });
});
