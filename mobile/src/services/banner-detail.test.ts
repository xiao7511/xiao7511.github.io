import { readFile } from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { fetchAdminLinkableContent, updateAdminBanner } from './admin';
import { buildHomeData, contentRoute } from './home';
import type { ContentItem } from '../types/content';

const topic = (category: 'anime' | 'manga', id: string): ContentItem => ({
  id,
  category,
  slot_index: 0,
  title: `${category} topic`,
  cover_url: `https://example.com/${id}-cover.webp`,
  detail_urls: [`https://example.com/${id}-1.webp`, `https://example.com/${id}-2.webp`]
});

describe('Banner linked detail management', () => {
  for (const category of ['anime', 'manga'] as const) {
    test(`links Banner to the canonical ${category} row without copying detail fields`, () => {
      const linked = topic(category, `${category}-id`);
      const banner: ContentItem = {
        id: `banner-${category}`,
        category: 'banner',
        slot_index: 0,
        title: 'Banner',
        cover_url: 'https://example.com/banner-home.webp',
        linked_content_id: linked.id
      };
      const result = buildHomeData([banner], [linked]).banners[0];
      expect(result.cover_url).toBe('https://example.com/banner-home.webp');
      expect(result.linkedContent).toBe(linked);
      expect(result.linkedContent?.detail_urls).toBe(linked.detail_urls);
      expect(contentRoute(result)).toBe(`/${category}/${linked.id}`);
    });
  }

  test('writes only Banner metadata/association and scopes the update to category banner', async () => {
    const categoryEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const idEq = vi.fn(() => ({ eq: categoryEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    const client = { from: vi.fn(() => ({ update })) } as unknown as SupabaseClient;
    await updateAdminBanner(client, 'banner-id', {
      title: 'Banner', subtitle: 'Home only', slot_index: 0, linked_content_id: 'anime-id'
    });
    expect(update).toHaveBeenCalledWith(expect.not.objectContaining({ cover_url: expect.anything(), detail_urls: expect.anything() }));
    expect(categoryEq).toHaveBeenCalledWith('category', 'banner');
  });

  test('loads only canonical Anime/Manga candidates', async () => {
    const rows = [topic('anime', 'anime-id'), topic('manga', 'manga-id')];
    const finalOrder = vi.fn().mockResolvedValue({ data: rows, error: null });
    const firstOrder = vi.fn(() => ({ order: finalOrder }));
    const inCategory = vi.fn(() => ({ order: firstOrder }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ in: inCategory })) })) } as unknown as SupabaseClient;
    await expect(fetchAdminLinkableContent(client)).resolves.toEqual(rows);
    expect(inCategory).toHaveBeenCalledWith('category', ['anime', 'manga']);
  });

  test('both admin entry points use the same cover/gallery editor and unlinked Banner is disabled', async () => {
    const [bannerView, contentView, editor] = await Promise.all([
      readFile(new URL('../views/AdminBannersView.vue', import.meta.url), 'utf8'),
      readFile(new URL('../views/AdminContentView.vue', import.meta.url), 'utf8'),
      readFile(new URL('../components/AdminContentImageEditor.vue', import.meta.url), 'utf8')
    ]);
    expect(bannerView).toContain("import AdminContentImageEditor");
    expect(contentView).toContain("import AdminContentImageEditor");
    expect(bannerView).toContain(':disabled="!linkedContent(item)');
    expect(bannerView).toContain('未关联主题内容');
    expect(editor).toContain('saveAdminContentImage');
    expect(editor).toContain('saveAdminDetailGallery');
  });
});
