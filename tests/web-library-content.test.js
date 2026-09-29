import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { libraryItemModel, normalizeLibraryText, selectLibraryItems } from '../public/assets/js/src/content/library.js';

function item(id, category, slot, changes = {}) {
  return {
    id,
    category,
    slot_index: slot,
    title: `${category} ${id}`,
    is_active: true,
    ...changes
  };
}

describe('Web Anime and Manga library contract', () => {
  test.each(['anime', 'manga'])('selects canonical active and legacy-null %s items', (category) => {
    const rows = [
      item('active', category, 0),
      item('legacy', category, 1, { is_active: null }),
      item('disabled', category, 2, { is_active: false })
    ];
    expect(selectLibraryItems(rows, category).map(({ id }) => id)).toEqual(['active', 'legacy']);
  });

  test('rejects wrong-category and malformed rows without breaking valid content', () => {
    const rows = [
      item('manga', 'manga', 0),
      item('', 'anime', 0),
      item('empty-title', 'anime', 1, { title: '' }),
      item('bad-slot', 'anime', -1),
      null,
      item('valid', 'anime', 3)
    ];
    expect(selectLibraryItems(rows, 'anime').map(({ id }) => id)).toEqual(['valid']);
  });

  test('uses deterministic slot/id ordering and removes duplicate content ids', () => {
    const rows = [item('z', 'anime', 1), item('b', 'anime', 0), item('a', 'anime', 0), item('a', 'anime', 4)];
    expect(selectLibraryItems(rows, 'anime').map(({ id }) => id)).toEqual(['a', 'b', 'z']);
  });

  test('uses NFKC case-insensitive matching without reviving inactive content', () => {
    const rows = [
      item('match', 'anime', 0, { title: 'ＮＡＲＵＴＯ', theme_tags: ['Action'] }),
      item('disabled', 'anime', 1, { title: 'naruto', is_active: false })
    ];
    expect(normalizeLibraryText(' Ｎａｒｕｔｏ ')).toBe('naruto');
    expect(selectLibraryItems(rows, 'anime', 'naruto').map(({ id }) => id)).toEqual(['match']);
  });

  test('normalizes list year and duplicate/malformed tags', () => {
    const model = libraryItemModel(
      item('metadata', 'manga', 2, {
        year: null,
        published_at: '2026-02-03',
        theme_tags: [' Fantasy ', 'fantasy', '', null, 'Drama']
      })
    );
    expect(model).toEqual({
      detailUrl: 'detail.html?category=manga&slot=2',
      year: '2026',
      tags: ['Fantasy', 'Drama']
    });
  });

  test('keeps missing metadata safe and returns explicit empty results', () => {
    expect(libraryItemModel(item('empty', 'anime', 0, { year: {}, theme_tags: 'bad' }))).toEqual({
      detailUrl: 'detail.html?category=anime&slot=0',
      year: '',
      tags: []
    });
    expect(selectLibraryItems([], 'anime')).toEqual([]);
    expect(selectLibraryItems([item('off', 'manga', 0, { is_active: false })], 'manga')).toEqual([]);
  });

  test('keeps both Web list pages on safe loading, empty and network-error states', async () => {
    const [animePage, mangaPage] = await Promise.all([
      readFile(new URL('../public/assets/js/src/pages/recommend.js', import.meta.url), 'utf8'),
      readFile(new URL('../public/assets/js/src/pages/manga.js', import.meta.url), 'utf8')
    ]);
    for (const source of [animePage, mangaPage]) {
      expect(source).toContain('setLoadingState');
      expect(source).toContain('setContentState');
      expect(source).toContain("kind: 'error'");
      expect(source).not.toContain('innerHTML');
    }
  });
});
