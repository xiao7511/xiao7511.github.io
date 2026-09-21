import { describe, expect, test } from 'vitest';
import { imageTargetKey, isImageTarget, mapImageLikeSummaries } from '../public/assets/js/src/images/likes.js';
import { isValidSocialUrl } from '../public/assets/js/src/config/social.js';

const target = {
  contentId: 'd9428888-122b-4f20-9f6c-25789ab0a123',
  kind: 'detail',
  index: 2
};

describe('image engagement helpers', () => {
  test('uses stable content id, image kind and index as the target key', () => {
    expect(isImageTarget(target)).toBe(true);
    expect(imageTargetKey(target)).toBe(`${target.contentId}:detail:2`);
    expect(isImageTarget({ ...target, contentId: 'https://example.com/image.jpg' })).toBe(false);
  });

  test('normalizes one batched like summary response', () => {
    const summary = mapImageLikeSummaries([
      {
        content_id: target.contentId,
        image_kind: target.kind,
        image_index: target.index,
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
