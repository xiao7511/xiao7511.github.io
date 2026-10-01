import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
  isValidSocialUrl,
  parseSocialSettings,
  serializeSocialSettings,
  SOCIAL_KEYS,
  SOCIAL_LABELS
} from '../public/assets/js/src/config/social.js';

describe('canonical Web social links', () => {
  test('normalizes exactly four platforms, aliases, labels, and default ordering', () => {
    const settings = parseSocialSettings({ twitter: 'https://twitter.com/legacy', x: 'https://x.com/nobi' });
    expect(SOCIAL_KEYS).toEqual(['xiaohongshu', 'weibo', 'x', 'instagram']);
    expect(settings.map(({ key }) => key)).toEqual(SOCIAL_KEYS);
    expect(settings.map(({ label }) => label)).toEqual(['小红书', '微博', 'X', 'Instagram']);
    expect(settings.find(({ key }) => key === 'x')?.url).toBe('https://x.com/nobi');
    expect(SOCIAL_LABELS.x).toBe('X');
  });

  test.each([
    ['xiaohongshu', 'https://www.xiaohongshu.com/user/profile/nobi'],
    ['xiaohongshu', 'https://xhslink.com/a/nobi'],
    ['xiaohongshu', 'https://xhslink.cn/o/2ElEjvQMl69'],
    ['xiaohongshu', 'https://m.xhslink.cn/o/example'],
    ['weibo', 'https://m.weibo.cn/u/123'],
    ['x', 'https://twitter.com/nobi'],
    ['x', 'https://www.x.com/nobi'],
    ['instagram', 'https://www.instagram.com/nobi']
  ])('accepts configured %s platform URL %s', (platform, url) => {
    expect(isValidSocialUrl(url, platform)).toBe(true);
  });

  test.each([
    '',
    '   ',
    'null',
    'undefined',
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///tmp/a',
    'not-a-url',
    'https://evil.example/nobi',
    'https://xhslink.cn.evil.example/path',
    'https://evil-xhslink.cn/path',
    'https://example.com/xhslink.cn',
    'https://xiaohongshu.com@evil.example/nobi'
  ])('rejects unavailable or unsafe URL %s for display', (url) => {
    expect(isValidSocialUrl(url, 'xiaohongshu')).toBe(url.trim() === '');
  });

  test('resolves the production-shaped configuration into the four canonical links', () => {
    const settings = parseSocialSettings({
      xiaohongshu: 'https://xhslink.cn/o/2ElEjvQMl69',
      weibo: 'http://weibo.com',
      twitter: 'https://x.com',
      instagram: 'https://instagram.com'
    });
    const links = settings.filter((item) => item.enabled && item.url && isValidSocialUrl(item.url, item.key));

    expect(settings.map((item) => item.key)).toEqual(['xiaohongshu', 'weibo', 'x', 'instagram']);
    expect(links.map((item) => item.key)).toEqual(['xiaohongshu', 'weibo', 'x', 'instagram']);
    expect(settings.find((item) => item.key === 'x')?.url).toBe('https://x.com');
  });

  test('trims values, honors valid configured order, filters invalid platforms independently', () => {
    const settings = parseSocialSettings({
      weibo: ' https://weibo.com/nobi ',
      instagram: 'javascript:alert(1)',
      x: 'https://x.com/nobi',
      _enabled: { weibo: true, instagram: true, x: true },
      _order: ['x', 'Twitter', 'weibo', 'instagram']
    });
    const publicLinks = settings.filter((item) => item.enabled && item.url && isValidSocialUrl(item.url, item.key));
    expect(settings.map((item) => item.key)).toEqual(['x', 'weibo', 'instagram', 'xiaohongshu']);
    expect(publicLinks.map((item) => item.key)).toEqual(['x', 'weibo']);
    expect(settings.find((item) => item.key === 'weibo')?.url).toBe('https://weibo.com/nobi');
  });

  test('serializes the canonical shape and preserves unrelated config fields', () => {
    const settings = parseSocialSettings({
      twitter: 'https://twitter.com/nobi',
      _enabled: { twitter: true, custom: 'kept' },
      _order: ['twitter'],
      custom_config: { theme: 'dark' }
    });
    const saved = JSON.parse(serializeSocialSettings(settings));
    expect(saved.x).toBe('https://twitter.com/nobi');
    expect(saved.twitter).toBeUndefined();
    expect(saved._enabled.x).toBe(true);
    expect(saved._enabled.custom).toBe('kept');
    expect(saved._order).toEqual(['x', 'xiaohongshu', 'weibo', 'instagram']);
    expect(saved.custom_config).toEqual({ theme: 'dark' });
  });

  test('Web Home and Admin use the canonical parser and persist the shared row safely', async () => {
    const [home, admin, html] = await Promise.all([
      readFile(new URL('../public/assets/js/src/site-v2.js', import.meta.url), 'utf8'),
      readFile(new URL('../public/assets/js/admin-v2.js', import.meta.url), 'utf8'),
      readFile(new URL('../public/admin.html', import.meta.url), 'utf8')
    ]);
    expect(home).toContain('parseSocialSettings(config)');
    expect(home).toContain("target: '_blank'");
    expect(home).toContain("rel: 'noopener noreferrer'");
    expect(home).not.toContain('anchor.innerHTML');
    expect(home).not.toContain('insertAdjacentHTML');
    expect(admin).toContain('serializeSocialSettings(loadedSocialSettings)');
    expect(admin).toContain("section: 'social_links'");
    const socialSave = admin.slice(
      admin.indexOf('function initSocialForm'),
      admin.indexOf('function initContentTools')
    );
    expect(socialSave).not.toContain('error.message');
    expect(socialSave).toContain('if (!socialConfigLoaded)');
    expect(socialSave).toContain('item.enabled = enabledInput.checked');
    expect(html).toContain('id="social-x"');
    expect(html).toContain('id="social-x-enabled"');
    expect(home).toContain(".from('site_config')");
  });
});
