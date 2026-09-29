import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import type { ContentItem } from '../types/content';
import { contentRoute } from './home';
import { contentImageUrl } from './images';
import {
  filterLibraryItems,
  libraryRegions,
  libraryTags,
  libraryYears,
  normalizeLibraryText
} from './library';

function item(id: string, category: string, slot: number, changes: Partial<ContentItem> = {}): ContentItem {
  return { id, category, slot_index: slot, title: `${category} ${id}`, is_active: true, ...changes };
}

describe('Mobile Anime and Manga library contract', () => {
  test.each(['anime', 'manga'] as const)('includes canonical active and legacy-null %s items', (category) => {
    const rows = [
      item('active', category, 0),
      item('legacy', category, 1, { is_active: null }),
      item('disabled', category, 2, { is_active: false })
    ];
    expect(filterLibraryItems(rows, category).map(({ id }) => id)).toEqual(['active', 'legacy']);
  });

  test('rejects wrong categories and malformed identity/title/slot while retaining valid rows', () => {
    const rows: unknown[] = [
      item('wrong', 'manga', 0),
      item('', 'anime', 0),
      item('empty-title', 'anime', 1, { title: '' }),
      item('bad-slot', 'anime', -1),
      null,
      item('valid', 'anime', 3)
    ];
    expect(filterLibraryItems(rows, 'anime').map(({ id }) => id)).toEqual(['valid']);
  });

  test('uses deterministic default and tie ordering and removes duplicate ids', () => {
    const rows = [item('z', 'anime', 1), item('b', 'anime', 0), item('a', 'anime', 0), item('a', 'anime', 5)];
    expect(filterLibraryItems(rows, 'anime').map(({ id }) => id)).toEqual(['a', 'b', 'z']);
  });

  test('normalizes NFKC search and combined filters without reviving disabled rows', () => {
    const rows = [
      item('match', 'anime', 0, {
        title: 'ＮＡＲＵＴＯ',
        theme_tags: [' Action ', 'action', 'Ninja'],
        year: 2026,
        status: '连载中',
        region: '日本'
      }),
      item('disabled', 'anime', 1, { title: 'naruto', theme_tags: ['Action'], is_active: false })
    ];
    expect(normalizeLibraryText(' Ｎａｒｕｔｏ ')).toBe('naruto');
    expect(
      filterLibraryItems(rows, 'anime', {
        search: 'naruto',
        tag: 'action',
        state: '连载中',
        year: '2026',
        region: '日本'
      }).map(({ id }) => id)
    ).toEqual(['match']);
    expect(filterLibraryItems(rows, 'anime', {}).map(({ id }) => id)).toEqual(['match']);
  });

  test('sorts popularity and year with safe counts and deterministic ties', () => {
    const rows = [
      item('a', 'manga', 0, { year: 2024 }),
      item('b', 'manga', 1, { year: 2026 }),
      item('c', 'manga', 2, { year: null })
    ];
    const likes = new Map<string, number>([
      ['a', Number.NaN],
      ['b', 5],
      ['c', 5]
    ]);
    expect(filterLibraryItems(rows, 'manga', { state: 'hot' }, (entry) => likes.get(entry.id) ?? 0).map(({ id }) => id)).toEqual([
      'b',
      'c',
      'a'
    ]);
    expect(filterLibraryItems(rows, 'manga', { sort: 'year' }).map(({ id }) => id)).toEqual(['b', 'a', 'c']);
  });

  test('normalizes filter options and excludes malformed/duplicate metadata', () => {
    const rows = [
      item('a', 'anime', 0, { theme_tags: [' Fantasy ', 'fantasy', '', 'Drama'], year: 2026, region: ' 日本 ' }),
      item('b', 'anime', 1, { theme_tags: 'bad' as unknown as string[], year: null, region: '日本' })
    ];
    expect(libraryTags(rows)).toEqual(['Fantasy', 'Drama']);
    expect(libraryYears(rows)).toEqual(['2026']);
    expect(libraryRegions(rows)).toEqual(['日本']);
  });

  test('keeps canonical Anime and Manga routes and rejects malformed navigation', () => {
    expect(contentRoute(item('anime-id', 'anime', 1))).toBe('/anime/anime-id');
    expect(contentRoute(item('manga-id', 'manga', 1))).toBe('/manga/manga-id');
    expect(contentRoute(item('bad', 'anime', -1))).toBe('');
  });

  test('keeps missing and broken covers on the established component fallback path', async () => {
    expect(contentImageUrl(null)).toBeUndefined();
    expect(contentImageUrl('https://untrusted.example/cover.webp')).toBeUndefined();
    const component = await readFile(new URL('../components/ContentImage.vue', import.meta.url), 'utf8');
    expect(component).toContain('v-if="url && !failed"');
    expect(component).toContain('v-else class="image-fallback"');
    expect(component).toContain('@error="failed = true"');
  });

  test('returns explicit empty Anime and Manga sets without cross-category substitution', () => {
    expect(filterLibraryItems([], 'anime')).toEqual([]);
    expect(filterLibraryItems([item('anime', 'anime', 0)], 'manga')).toEqual([]);
  });
});
