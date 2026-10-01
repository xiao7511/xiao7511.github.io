import { describe, expect, test } from 'vitest';
import {
  BANNER_FALLBACK_URL,
  applyBannerCtaTargets,
  mapActiveBanners,
  resolveBannerItems
} from '../public/assets/js/src/home/banners.js';

function banner(id, slot, changes = {}) {
  return {
    id,
    category: 'banner',
    slot_index: slot,
    title: `Banner ${id}`,
    subtitle: `Subtitle ${id}`,
    theme_tags: ['featured', id],
    cover_url: `https://example.test/${id}.webp`,
    is_active: true,
    ...changes
  };
}

function content(id, category, slot, changes = {}) {
  return { id, category, slot_index: slot, title: `Title ${id}`, is_active: true, ...changes };
}

describe('Web Home canonical Banner behavior', () => {
  test('renders active and legacy-null Banners while excluding explicitly inactive records', () => {
    const rows = [
      banner('active', 0),
      banner('inactive', 1, { is_active: false }),
      banner('legacy', 2, { is_active: null })
    ];
    expect(mapActiveBanners(rows).map((item) => item.id)).toEqual(['active', 'legacy']);
  });

  test('resolves an Anime association to the existing Web detail convention', () => {
    const linked = content('anime-id', 'anime', 4);
    const result = resolveBannerItems([banner('hero', 0, { linked_content_id: linked.id })], [linked]);
    expect(result[0]).toMatchObject({ linkedContent: linked, detailUrl: 'detail.html?category=anime&slot=4' });
  });

  test('resolves a Manga association to the existing Web detail convention', () => {
    const linked = content('manga-id', 'manga', 7);
    const result = resolveBannerItems([banner('hero', 0, { linked_content_id: linked.id })], [linked]);
    expect(result[0]).toMatchObject({ linkedContent: linked, detailUrl: 'detail.html?category=manga&slot=7' });
  });

  test('uses the safe Web fallback when no linked_content_id exists', () => {
    expect(resolveBannerItems([banner('hero', 0)], [])[0].detailUrl).toBe(BANNER_FALLBACK_URL);
  });

  test('does not turn an invalid linked_content_id into a malformed or identifier-bearing URL', () => {
    const linkedId = 'not-a-real-content-id';
    const result = resolveBannerItems([banner('hero', 0, { linked_content_id: linkedId })], [])[0];
    expect(result.detailUrl).toBe(BANNER_FALLBACK_URL);
    expect(result.detailUrl).not.toContain(linkedId);
    expect(result.detailUrl).not.toMatch(/(?:undefined|null)/);
  });

  test('does not activate a detail CTA for an inactive or unsupported linked target', () => {
    for (const linked of [
      content('disabled', 'anime', 1, { is_active: false }),
      content('unsupported', 'banner', 1),
      content('untitled', 'anime', 1, { title: '  ' }),
      content('bad-slot', 'manga', -1)
    ]) {
      const result = resolveBannerItems([banner('hero', 0, { linked_content_id: linked.id })], [linked])[0];
      expect(result.detailUrl).toBe(BANNER_FALLBACK_URL);
      expect(result.linkedContent).toBeUndefined();
    }
  });

  test('keeps ordering deterministic by slot and then id', () => {
    const rows = [banner('z', 1), banner('c', 0), banner('a', 1), banner('outside', 3)];
    expect(mapActiveBanners(rows).map((item) => item.id)).toEqual(['c', 'a', 'z']);
  });

  test('preserves Banner image, title, subtitle and tags during association resolution', () => {
    const source = banner('hero', 0, { linked_content_id: 'anime-id' });
    const result = resolveBannerItems([source], [content('anime-id', 'anime', 2)])[0];
    expect(result).toMatchObject({
      cover_url: source.cover_url,
      title: source.title,
      subtitle: source.subtitle,
      theme_tags: source.theme_tags
    });
  });

  test('preserves linked behavior when a valid Banner needs its fallback image', () => {
    const source = banner('hero', 0, { cover_url: null, linked_content_id: 'anime-id' });
    const result = resolveBannerItems([source], [content('anime-id', 'anime', 2)])[0];
    expect(result).toMatchObject({ cover_url: null, detailUrl: 'detail.html?category=anime&slot=2' });
  });

  test('assigns the same validated destination to both CTA actions and rejects arbitrary URLs', () => {
    const primary = { href: '' };
    const detail = { href: '' };
    expect(applyBannerCtaTargets([primary, detail], 'detail.html?category=anime&slot=2')).toBe(
      'detail.html?category=anime&slot=2'
    );
    expect(primary.href).toBe(detail.href);
    expect(applyBannerCtaTargets([primary, detail], 'javascript:alert(1)')).toBe(BANNER_FALLBACK_URL);
    expect(primary.href).toBe(BANNER_FALLBACK_URL);
    expect(detail.href).toBe(BANNER_FALLBACK_URL);
  });
});
