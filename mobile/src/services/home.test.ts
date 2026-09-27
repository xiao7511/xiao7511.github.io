import { readFile } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import {
  buildHomeData,
  contentRoute,
  fetchHomeData,
  mapWebBanners,
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

  test('keeps the clicked banner bound to its own detail object', () => {
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
    const mangaKey = storageImageKey(manga.detail_urls?.[0]);
    const data = buildHomeData([], [anime, manga], new Map(mangaKey ? [[mangaKey, 9]] : []));
    expect(data.ranking[0]).toMatchObject({ id: manga.id, likeCount: 9 });
  });

  test('queries the same content tables on every load', async () => {
    const bannerOrder = vi.fn().mockResolvedValue({ data: banners, error: null });
    const bannerEq = vi.fn(() => ({ order: bannerOrder }));
    const socialSingle = vi.fn().mockResolvedValue({ data: { url: '{}' }, error: null });
    const socialEq = vi.fn(() => ({ maybeSingle: socialSingle }));
    let contentCall = 0;
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => {
        if (table === 'site_config') return { eq: socialEq };
        contentCall += 1;
        return contentCall === 1
          ? { eq: bannerEq }
          : Promise.resolve({ data: [item('anime', 0, '实时内容')], error: null });
      })
    }));
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { from, rpc } as unknown as SupabaseClient;

    const result = await fetchHomeData(client);
    expect(result.banners).toHaveLength(3);
    expect(result.banners[0]).toMatchObject({ title: '第一张' });
    expect(bannerEq).toHaveBeenCalledWith('category', 'banner');
    expect(bannerOrder).toHaveBeenCalledWith('slot_index', { ascending: true });
    expect(from).toHaveBeenCalledWith('site_config');
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
