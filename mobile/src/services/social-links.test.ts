import { describe, expect, test } from 'vitest';
import {
  canonicalSocialKey,
  isValidSocialUrl,
  parseSocialSettings,
  serializeSocialSettings,
  SOCIAL_KEYS
} from './social-links';

describe('shared social link configuration', () => {
  test('reads the legacy flat URL format in the established order', () => {
    const rows = parseSocialSettings('{"weibo":"https://weibo.com/nobi","twitter":""}');
    expect(rows.find((item) => item.key === 'weibo')).toMatchObject({ enabled: true, url: 'https://weibo.com/nobi' });
    expect(rows.find((item) => item.key === 'x')).toMatchObject({ enabled: false, url: '' });
    expect(rows.map((item) => item.key)).toEqual(SOCIAL_KEYS);
    expect(canonicalSocialKey('Twitter')).toBe('x');
    expect(canonicalSocialKey('小红书')).toBe('xiaohongshu');
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
    expect(isValidSocialUrl(' https://x.com/nobi ', 'x')).toBe(true);
    expect(isValidSocialUrl('https://www.xiaohongshu.com/nobi', 'xiaohongshu')).toBe(true);
    expect(isValidSocialUrl('https://m.weibo.cn/nobi', 'weibo')).toBe(true);
    expect(isValidSocialUrl('https://www.instagram.com/nobi', 'instagram')).toBe(true);
    expect(isValidSocialUrl('http://instagram.com/nobi', 'instagram')).toBe(true);
    expect(isValidSocialUrl('javascript:alert(1)')).toBe(false);
    expect(isValidSocialUrl('data:text/html,hi')).toBe(false);
    expect(isValidSocialUrl('file:///tmp/a')).toBe(false);
    expect(isValidSocialUrl('null', 'x')).toBe(false);
    expect(isValidSocialUrl('undefined', 'x')).toBe(false);
    expect(isValidSocialUrl('https://example.org/attacker', 'x')).toBe(false);
    expect(isValidSocialUrl('not-a-url', 'weibo')).toBe(false);
  });

  test('normalizes legacy aliases/order and preserves unrelated config values on save', () => {
    const rows = parseSocialSettings({
      twitter: 'https://twitter.com/nobi',
      _enabled: { twitter: true, custom: 'kept' },
      _order: ['twitter', 'X', 'instagram'],
      custom_config: { theme: 'dark' }
    });
    expect(rows.map((row) => row.key)).toEqual(['x', 'instagram', 'xiaohongshu', 'weibo']);
    const saved = JSON.parse(serializeSocialSettings(rows));
    expect(saved.x).toBe('https://twitter.com/nobi');
    expect(saved.twitter).toBeUndefined();
    expect(saved._enabled.x).toBe(true);
    expect(saved._enabled.custom).toBe('kept');
    expect(saved.custom_config).toEqual({ theme: 'dark' });
  });
});
