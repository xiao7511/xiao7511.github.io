import { describe, expect, test } from 'vitest';
import {
  createRecommendDetailUrl,
  filterRecommendItems,
  readSearchQuery,
  updateSearchSummary
} from '../public/assets/js/src/search/content.js';

const rows = [
  {
    id: 'anime-1',
    category: 'anime',
    slot_index: 1,
    title: 'Naruto',
    theme_tags: ['Action', 'Ninja'],
    year: 2002,
    is_active: true
  },
  {
    id: 'anime-2',
    category: 'anime',
    slot_index: 2,
    title: 'Frieren',
    theme_tags: ['Fantasy'],
    year: '2023',
    is_active: null
  }
];

describe('Web recommend search', () => {
  test('reads and trims q from the recommend URL', () => {
    expect(readSearchQuery('?page=1&q=%20naruto%20')).toBe('naruto');
  });

  test('matches title case-insensitively', () => {
    expect(filterRecommendItems(rows, 'NARUTO').map((item) => item.id)).toEqual(['anime-1']);
  });

  test('matches theme tags', () => {
    expect(filterRecommendItems(rows, 'fantasy').map((item) => item.id)).toEqual(['anime-2']);
  });

  test('matches year metadata', () => {
    expect(filterRecommendItems(rows, '2002').map((item) => item.id)).toEqual(['anime-1']);
  });

  test('returns an empty result for a non-match', () => {
    expect(filterRecommendItems(rows, 'does-not-exist')).toEqual([]);
  });

  test('preserves normal active result ordering for an empty query', () => {
    expect(filterRecommendItems(rows, '').map((item) => item.id)).toEqual(['anime-1', 'anime-2']);
  });

  test('renders script-like query text through textContent only', () => {
    const node = { hidden: true, textContent: '' };
    updateSearchSummary(node, '<script>alert(1)</script>', 0);
    expect(node).toEqual({ hidden: false, textContent: '“<script>alert(1)</script>” 的搜索结果：0 项' });
    expect(node).not.toHaveProperty('innerHTML');
  });

  test('keeps matching cards on the canonical Web detail route', () => {
    expect(createRecommendDetailUrl(filterRecommendItems(rows, 'ninja')[0])).toBe('detail.html?category=anime&slot=1');
  });
});
