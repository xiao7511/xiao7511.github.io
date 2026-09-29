import { normalizeLibraryText, selectLibraryItems } from '../content/library.js';
import { createHomeDetailUrl } from '../home/content.js';

const MAX_QUERY_LENGTH = 200;

export function readSearchQuery(search = '') {
  try {
    return String(new URLSearchParams(String(search)).get('q') || '')
      .trim()
      .slice(0, MAX_QUERY_LENGTH);
  } catch {
    return '';
  }
}

export function normalizeSearchText(value) {
  return normalizeLibraryText(value);
}

export function createRecommendDetailUrl(item) {
  return item?.category === 'anime' ? createHomeDetailUrl(item) : '';
}

export function filterRecommendItems(rows, query = '') {
  return selectLibraryItems(rows, 'anime', query);
}

export function updateSearchSummary(node, query, count) {
  if (!node) return;
  const trimmed = String(query || '').trim();
  node.hidden = !trimmed;
  node.textContent = trimmed ? `“${trimmed}” 的搜索结果：${count} 项` : '';
}
