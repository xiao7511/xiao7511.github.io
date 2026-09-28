import { describe, expect, test } from 'vitest';
import { isValidSocialUrl, parseSocialSettings, serializeSocialSettings } from './social-links';

describe('shared social link configuration', () => {
  test('reads the legacy flat URL format in the established order', () => {
    const rows = parseSocialSettings('{"weibo":"https://weibo.com/nobi","twitter":""}');
    expect(rows.find((item) => item.key === 'weibo')).toMatchObject({ enabled: true, url: 'https://weibo.com/nobi' });
    expect(rows.find((item) => item.key === 'twitter')).toMatchObject({ enabled: false, url: '' });
  });

  test('preserves URL compatibility while adding enabled state and order metadata', () => {
    const rows = parseSocialSettings({
      weibo: 'https://weibo.com/nobi',
      instagram: 'https://instagram.com/nobi',
      _enabled: { weibo: false, instagram: true },
      _order: ['instagram', 'weibo']
    });
    expect(rows.slice(0, 2).map((item) => item.key)).toEqual(['instagram', 'weibo']);
    const serialized = JSON.parse(serializeSocialSettings(rows));
    expect(serialized.weibo).toBe('https://weibo.com/nobi');
    expect(serialized._enabled.weibo).toBe(false);
    expect(serialized._order.slice(0, 2)).toEqual(['instagram', 'weibo']);
  });

  test('accepts empty or HTTP(S) URLs and rejects unsafe schemes', () => {
    expect(isValidSocialUrl('')).toBe(true);
    expect(isValidSocialUrl('https://x.com/nobi')).toBe(true);
    expect(isValidSocialUrl('javascript:alert(1)')).toBe(false);
  });
});
