import type { ContentItem } from '../types/content';
import { contentYear, normalizeContentTags, selectCanonicalContent } from './home';

export type LibraryCategory = 'anime' | 'manga';
export type LibrarySort = 'slot' | 'year';

export interface LibraryFilters {
  search?: string;
  tag?: string;
  state?: string;
  year?: string;
  region?: string;
  sort?: LibrarySort;
}

export function normalizeLibraryText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

function defaultOrder(a: ContentItem, b: ContentItem): number {
  return a.slot_index - b.slot_index || a.id.localeCompare(b.id);
}

function safeLikeCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function filterLibraryItems(
  rows: unknown,
  category: LibraryCategory,
  filters: LibraryFilters = {},
  likeCount: (item: ContentItem) => number = () => 0
): ContentItem[] {
  const needle = normalizeLibraryText(filters.search);
  const selectedTag = normalizeLibraryText(filters.tag);
  const selectedState = normalizeLibraryText(filters.state);
  const selectedYear = String(filters.year ?? '').trim();
  const selectedRegion = normalizeLibraryText(filters.region);
  const items = selectCanonicalContent(rows, category).filter((item) => {
    const tags = normalizeContentTags(item, Number.MAX_SAFE_INTEGER);
    const searchable = [item.title, item.subtitle, tags, item.status, item.region]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .some((value) => normalizeLibraryText(value).includes(needle));
    const stateText = [item.status, ...tags].map(normalizeLibraryText);
    return (
      (!needle || searchable) &&
      (!selectedState || selectedState === 'all' || selectedState === 'hot' || stateText.includes(selectedState)) &&
      (!selectedTag || tags.some((tag) => normalizeLibraryText(tag) === selectedTag)) &&
      (!selectedYear || contentYear(item) === selectedYear) &&
      (!selectedRegion || normalizeLibraryText(item.region) === selectedRegion)
    );
  });

  if (selectedState === 'hot') {
    return [...items].sort(
      (a, b) => safeLikeCount(likeCount(b)) - safeLikeCount(likeCount(a)) || defaultOrder(a, b)
    );
  }
  if (filters.sort === 'year') {
    return [...items].sort((a, b) => {
      const aYear = contentYear(a) === '--' ? '' : contentYear(a);
      const bYear = contentYear(b) === '--' ? '' : contentYear(b);
      if (aYear !== bYear) return bYear.localeCompare(aYear);
      return defaultOrder(a, b);
    });
  }
  return items;
}

export function libraryTags(rows: ContentItem[]): string[] {
  const seen = new Set<string>();
  return rows
    .flatMap((item) => normalizeContentTags(item, Number.MAX_SAFE_INTEGER))
    .filter((tag) => {
      const key = normalizeLibraryText(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export function libraryYears(rows: ContentItem[]): string[] {
  return [...new Set(rows.map(contentYear).filter((value) => value !== '--'))].sort().reverse();
}

export function libraryRegions(rows: ContentItem[]): string[] {
  const seen = new Set<string>();
  return rows.flatMap((item) => {
    if (typeof item.region !== 'string' || !item.region.trim()) return [];
    const region = item.region.trim();
    const key = normalizeLibraryText(region);
    if (seen.has(key)) return [];
    seen.add(key);
    return [region];
  });
}
