import { createHomeDetailUrl, homeContentYear, normalizeContentTags, selectCanonicalContent } from '../home/content.js';

export function normalizeLibraryText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

export function selectLibraryItems(rows, category, query = '') {
  const items = selectCanonicalContent(rows, category);
  const needle = normalizeLibraryText(query);
  if (!needle) return items;
  return items.filter((item) =>
    [
      item.title,
      item.subtitle,
      normalizeContentTags(item, Number.MAX_SAFE_INTEGER),
      item.year,
      item.status,
      item.region
    ]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .some((value) => normalizeLibraryText(value).includes(needle))
  );
}

export function libraryItemModel(item) {
  return {
    detailUrl: createHomeDetailUrl(item),
    year: homeContentYear(item),
    tags: normalizeContentTags(item)
  };
}
