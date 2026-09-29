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
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

export function createRecommendDetailUrl(item) {
  if (!item || item.category !== 'anime' || !Number.isInteger(item.slot_index) || item.slot_index < 0) return '';
  return `detail.html?${new URLSearchParams({ category: 'anime', slot: String(item.slot_index) })}`;
}

export function filterRecommendItems(rows, query = '') {
  if (!Array.isArray(rows)) return [];
  const needle = normalizeSearchText(query);
  return rows.filter((item) => {
    if (!createRecommendDetailUrl(item) || item.is_active === false) return false;
    if (!needle) return true;
    return [item.title, item.name, item.theme_tags, item.year]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .some((value) => normalizeSearchText(value).includes(needle));
  });
}

export function updateSearchSummary(node, query, count) {
  if (!node) return;
  const trimmed = String(query || '').trim();
  node.hidden = !trimmed;
  node.textContent = trimmed ? `“${trimmed}” 的搜索结果：${count} 项` : '';
}
