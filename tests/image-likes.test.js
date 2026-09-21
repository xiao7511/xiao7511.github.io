import { describe, expect, test } from 'vitest';
import {
  getImageKey,
  imageTargetKey,
  isImageTarget,
  mapImageLikeSummaries
} from '../public/assets/js/src/images/likes.js';
import { isValidSocialUrl } from '../public/assets/js/src/config/social.js';

const firstImageUrl = 'https://supabase.example/storage/v1/object/public/images/anime/episode-1.webp?cache=123#preview';
const target = {
  contentId: 'd9428888-122b-4f20-9f6c-25789ab0a123',
  kind: 'detail',
  index: 2,
  imageKey: 'images/anime/episode-1.webp'
};

describe('image engagement helpers', () => {
  test('uses the normalized storage object identity as the target key', () => {
    expect(getImageKey(firstImageUrl)).toBe(target.imageKey);
    expect(isImageTarget(target)).toBe(true);
    expect(imageTargetKey(target)).toBe(target.imageKey);
    expect(isImageTarget({ ...target, contentId: 'https://example.com/image.jpg' })).toBe(false);
    expect(getImageKey('https://example.com/image.jpg')).toBeNull();
  });

  test('keeps a key through detail reordering and changes it when the object is replaced', () => {
    const reorderedTarget = { ...target, index: 0 };
    expect(imageTargetKey(reorderedTarget)).toBe(imageTargetKey(target));
    expect(getImageKey('https://supabase.example/storage/v1/object/public/images/anime/episode-2.webp')).not.toBe(
      target.imageKey
    );
  });

  test('normalizes one batched like summary response', () => {
    const summary = mapImageLikeSummaries([
      {
        image_key: target.imageKey,
        like_count: 12,
        liked: true
      }
    ]);
    expect(summary.get(imageTargetKey(target))).toEqual({ count: 12, liked: true });
  });

  test('accepts only empty or HTTP(S) social links', () => {
    expect(isValidSocialUrl('')).toBe(true);
    expect(isValidSocialUrl('https://weibo.com/nobi')).toBe(true);
    expect(isValidSocialUrl('javascript:alert(1)')).toBe(false);
    expect(isValidSocialUrl('not-a-url')).toBe(false);
  });
});
