import { readFile } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import {
  buildHomeData,
  contentLabel,
  contentRoute,
  contentYear,
  fetchHomeData,
  MOBILE_HOME_SECTION_LIMIT,
  mapSocialLinks,
  mapWebBanners,
  selectHomeContent,
  storageImageKey,
  WEB_HOME_BANNER_SLOTS
} from './home';
import type { ContentItem } from '../types/content';

function item(category: string, slot: number, title: string): ContentItem {
  return {
    id: `${category}-${slot}`,
    category,
    slot_index: slot,
    title,
    subtitle: `${title} 描述`,
    cover_url: `https://api.nobistudio.com/storage/v1/object/public/images/${category}-${slot}.webp`,
    detail_urls: [`https://api.nobistudio.com/storage/v1/object/public/images/${category}-${slot}-detail.webp`],
    theme_tags: [`标签${slot}`],
    updated_at: `2026-09-${String(slot + 10).padStart(2, '0')}T00:00:00Z`
  };
}

describe('Web-aligned mobile home data', () => {
  const banners = [
    item('banner', 2, '第三张'),
    item('banner', 0, '第一张'),
    item('banner', 4, '第五张'),
    item('banner', 1, '第二张')
  ];

  test('matches the three rendered Web slots, first record and slot order', () => {
    const mapped = mapWebBanners(banners);
    expect(WEB_HOME_BANNER_SLOTS).toBe(3);
    expect(mapped.map((entry) => entry.slot_index)).toEqual([0, 1, 2]);
    expect(mapped[0].title).toBe('第一张');
    expect(mapWebBanners(banners.filter((entry) => entry.slot_index !== 1)).map((entry) => entry.slot_index)).toEqual([
      0, 2
    ]);
  });

  test('routes a linked banner through the canonical category and id', () => {
    const anime = item('anime', 7, '关联动画');
    const linked = buildHomeData([{ ...banners[1], linked_content_id: anime.id }], [anime]).banners[0];
    expect(contentRoute(linked)).toBe('/anime/anime-7');
    expect(linked.cover_url).toBe(banners[1].cover_url);
    expect(linked.linkedContent?.cover_url).toBe(anime.cover_url);
  });

  test('keeps the legacy banner detail fallback when no valid topic is linked', () => {
    expect(contentRoute(mapWebBanners(banners)[0])).toBe('/banner/0/banner-0');
  });

  test('rebuilds from changed backend rows without a mobile content constant', () => {
    const initial = buildHomeData(banners, [item('anime', 0, '旧标题')]);
    const changed = buildHomeData(
      [{ ...item('banner', 0, '后台新标题'), cover_url: 'https://api.nobistudio.com/new.webp' }],
      [item('anime', 0, '新标题')]
    );
    expect(initial.banners[0].title).toBe('第一张');
    expect(changed.banners[0]).toMatchObject({ title: '后台新标题', cover_url: 'https://api.nobistudio.com/new.webp' });
    expect(changed.popular[0].title).toBe('新标题');
  });

  test('uses Web image-like keys for card counts and ranking', () => {
    const anime = item('anime', 0, '动漫');
    const manga = item('manga', 0, '漫画');
    const mangaKey = storageImageKey(manga.cover_url);
    const data = buildHomeData([], [anime, manga], new Map(mangaKey ? [[mangaKey, 9]] : []));
    expect(data.ranking[0]).toMatchObject({ id: manga.id, likeCount: 9 });
  });

  test('uses canonical active, category, slot, duplicate and deterministic-order rules', () => {
    const duplicate = item('anime', 3, 'Duplicate');
    duplicate.id = 'anime-a';
    const rows: unknown[] = [
      { ...item('anime', 1, 'Z'), id: 'anime-z' },
      { ...item('anime', 0, 'B'), id: 'anime-b' },
      { ...item('anime', 0, 'A'), id: 'anime-a', is_active: null },
      duplicate,
      { ...item('anime', 2, 'Disabled'), is_active: false },
      item('manga', 0, 'Wrong category'),
      { ...item('anime', -1, 'Invalid slot') },
      { ...item('anime', 4, 'Missing title'), title: '' }
    ];
    expect(selectHomeContent(rows, 'anime', 10).map((entry) => entry.id)).toEqual([
      'anime-a',
      'anime-b',
      'anime-z'
    ]);
  });

  test('keeps the accepted four-card Mobile presentation limit', () => {
    const rows = Array.from({ length: 7 }, (_, index) => item('anime', index, `Anime ${index}`));
    const data = buildHomeData([], rows);
    expect(MOBILE_HOME_SECTION_LIMIT).toBe(4);
    expect(data.popular.map((entry) => entry.slot_index)).toEqual([0, 1, 2, 3]);
  });

  test('keeps Anime and Manga navigation valid and rejects malformed content routes', () => {
    expect(contentRoute(item('anime', 2, 'Anime'))).toBe('/anime/anime-2');
    expect(contentRoute(item('manga', 5, 'Manga'))).toBe('/manga/manga-5');
    expect(contentRoute({ ...item('anime', -1, 'Invalid') })).toBe('');
    expect(contentRoute({ ...item('other', 1, 'Unsupported') })).toBe('');
  });

  test('normalizes absent likes and malformed metadata safely', () => {
    const anime = { ...item('anime', 0, 'Anime'), year: null, theme_tags: 'bad-data' } as unknown as ContentItem;
    const key = storageImageKey(anime.cover_url);
    const data = buildHomeData([], [anime], new Map(key ? [[key, Number.NaN]] : []));
    expect(data.popular[0].likeCount).toBe(0);
    expect(contentLabel(anime)).not.toContain('[object Object]');
    expect(contentYear(anime)).toBe('--');
  });

  test('returns safe empty sections when every record is malformed or inactive', () => {
    const data = buildHomeData([], [null, {}, { ...item('anime', 0, 'Off'), is_active: false }]);
    expect(data.popular).toEqual([]);
    expect(data.recommendations).toEqual([]);
  });

  test('hides disabled or empty social links and follows the shared configured order', () => {
    const links = mapSocialLinks({
      weibo: 'https://weibo.com/nobi',
      instagram: 'https://instagram.com/nobi',
      twitter: '',
      _enabled: { weibo: false, instagram: true },
      _order: ['instagram', 'weibo', 'twitter']
    });
    expect(links.map((link) => link.key)).toEqual(['instagram']);
  });

  test('keeps the canonical platform order and excludes one malformed social URL safely', () => {
    const links = mapSocialLinks({
      instagram: 'https://instagram.com/nobi',
      weibo: 'https://evil.example/nobi',
      x: 'https://x.com/nobi',
      xiaohongshu: 'https://www.xiaohongshu.com/user/nobi'
    });
    expect(links.map((link) => link.key)).toEqual(['xiaohongshu', 'x', 'instagram']);
  });

  test('queries the same content tables on every load', async () => {
    const bannerOrder = vi.fn().mockResolvedValue({ data: banners, error: null });
    const bannerQuery: { eq: ReturnType<typeof vi.fn>; order: typeof bannerOrder } = {
      eq: vi.fn(),
      order: bannerOrder
    };
    bannerQuery.eq.mockReturnValue(bannerQuery);
    const socialSingle = vi.fn().mockResolvedValue({ data: { url: '{}' }, error: null });
    const socialEq = vi.fn(() => ({ maybeSingle: socialSingle }));
    let contentCall = 0;
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => {
        if (table === 'site_config') return { eq: socialEq };
        contentCall += 1;
        return contentCall === 1 ? bannerQuery : Promise.resolve({ data: [item('anime', 0, '实时内容')], error: null });
      })
    }));
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { from, rpc } as unknown as SupabaseClient;

    const result = await fetchHomeData(client);
    expect(result.banners).toHaveLength(3);
    expect(result.banners[0]).toMatchObject({ title: '第一张' });
    expect(bannerQuery.eq).toHaveBeenCalledWith('category', 'banner');
    expect(bannerQuery.eq).not.toHaveBeenCalledWith('is_active', true);
    expect(bannerOrder).toHaveBeenCalledWith('slot_index', { ascending: true });
    expect(from).toHaveBeenCalledWith('site_config');
  });

  test('a social configuration request failure does not fail Home content', async () => {
    const bannerQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: banners, error: null })
    };
    const socialSingle = vi.fn().mockRejectedValue(new Error('social unavailable'));
    const socialEq = vi.fn(() => ({ maybeSingle: socialSingle }));
    let contentCall = 0;
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => {
        if (table === 'site_config') return { eq: socialEq };
        contentCall += 1;
        return contentCall === 1
          ? bannerQuery
          : Promise.resolve({ data: [item('anime', 0, 'Home survives')], error: null });
      })
    }));
    const client = { from, rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } as unknown as SupabaseClient;
    const result = await fetchHomeData(client);
    expect(result.popular[0]?.title).toBe('Home survives');
    expect(result.socialLinks).toEqual([]);
  });

  test('keeps the 393px layout constrained above the fixed tab bar', async () => {
    const css = await readFile(new URL('../style-home.css', import.meta.url), 'utf8');
    const base = await readFile(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toContain('overflow: clip');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('aspect-ratio: 1.72 / 1');
    expect(base).toContain('padding-bottom: calc(74px + env(safe-area-inset-bottom))');
  });
});
