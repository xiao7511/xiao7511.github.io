import { describe, expect, test } from 'vitest';
import {
  createHomeDetailUrl,
  homeContentLabel,
  homeContentYear,
  selectHomeContent,
  WEB_HOME_SECTION_LIMIT
} from '../public/assets/js/src/home/content.js';

function content(id, category, slot, changes = {}) {
  return {
    id,
    category,
    slot_index: slot,
    title: `Title ${id}`,
    cover_url: 'https://api.nobistudio.com/storage/v1/object/public/images/cover.webp',
    is_active: true,
    ...changes
  };
}

describe('Web Home canonical content presentation', () => {
  test('selects active and legacy-null content, excludes inactive and unsupported rows', () => {
    const selected = selectHomeContent(
      [
        content('active', 'anime', 0),
        content('inactive', 'anime', 1, { is_active: false }),
        content('legacy', 'anime', 2, { is_active: null }),
        content('banner', 'banner', 0)
      ],
      'anime'
    );
    expect(selected.map((item) => item.id)).toEqual(['active', 'legacy']);
  });

  test('orders by slot then id, removes duplicate records and enforces the Web limit', () => {
    const rows = [
      content('z', 'anime', 1),
      content('b', 'anime', 0),
      content('a', 'anime', 0),
      content('a', 'anime', 3),
      ...Array.from({ length: 8 }, (_, index) => content(`extra-${index}`, 'anime', index + 4))
    ];
    const selected = selectHomeContent(rows, 'anime');
    expect(WEB_HOME_SECTION_LIMIT).toBe(6);
    expect(selected.map((item) => item.id)).toEqual(['a', 'b', 'z', 'extra-0', 'extra-1', 'extra-2']);
  });

  test('rejects malformed identifiers, titles and slots without creating a detail target', () => {
    const rows = [
      content('', 'anime', 0),
      content('missing-title', 'anime', 1, { title: '' }),
      content('negative', 'anime', -1),
      content('too-large', 'anime', 1000),
      content('valid', 'anime', 3)
    ];
    expect(selectHomeContent(rows, 'anime').map((item) => item.id)).toEqual(['valid']);
    expect(createHomeDetailUrl(rows[0])).toBe('');
    expect(createHomeDetailUrl(rows[2])).toBe('');
    expect(createHomeDetailUrl(rows[4])).toBe('detail.html?category=anime&slot=3');
  });

  test('keeps Anime and Manga selection and navigation distinct', () => {
    const anime = content('anime', 'anime', 2);
    const manga = content('manga', 'manga', 4);
    expect(selectHomeContent([anime, manga], 'anime')).toEqual([anime]);
    expect(selectHomeContent([anime, manga], 'manga')).toEqual([manga]);
    expect(createHomeDetailUrl(manga)).toBe('detail.html?category=manga&slot=4');
  });

  test('normalizes year and tags without exposing malformed values', () => {
    expect(homeContentYear(content('year', 'anime', 0, { year: 2026 }))).toBe('2026');
    expect(homeContentYear(content('date', 'anime', 0, { year: null, published_at: '2025-02-03' }))).toBe('2025');
    expect(homeContentYear(content('missing', 'anime', 0, { year: null, published_at: null }))).toBe('');
    expect(homeContentYear(content('object', 'anime', 0, { year: { bad: true } }))).toBe('');
    expect(homeContentLabel(content('tags', 'anime', 0, { theme_tags: ['Fantasy', '', 'Drama'] }))).toBe(
      'Fantasy · Drama'
    );
    expect(homeContentLabel(content('bad-tags', 'manga', 0, { theme_tags: 'not-an-array' }))).toBe('漫画');
  });

  test('empty and entirely malformed sections safely produce no records', () => {
    expect(selectHomeContent([], 'anime')).toEqual([]);
    expect(selectHomeContent([null, {}, content('off', 'anime', 0, { is_active: false })], 'anime')).toEqual([]);
  });
});
