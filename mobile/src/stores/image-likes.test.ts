import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import type { ContentItem } from '../types/content';
import { useImageLikesStore } from './image-likes';

const item: ContentItem = {
  id: '80ad5b9d-a442-4fe5-b156-f8c79310aa11',
  category: 'anime',
  slot_index: 0,
  title: 'NOBI',
  cover_url: 'https://project.supabase.co/storage/v1/object/public/images/nobi.webp'
};

describe('image like store access boundary', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('never calls the toggle RPC for a signed-out user', async () => {
    const likes = useImageLikesStore();
    await expect(likes.toggle(item)).rejects.toThrow('AUTH_REQUIRED');
    expect(likes.get(item)).toEqual({ count: 0, liked: false });
  });
});
