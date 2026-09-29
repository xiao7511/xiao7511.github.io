export const WEB_HOME_SECTION_LIMIT = 6;

const SUPPORTED_CATEGORIES = new Set(['anime', 'manga']);

function validSlot(value) {
  return Number.isInteger(value) && value >= 0 && value <= 999;
}

export function isCanonicalHomeContent(item, category) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    item.is_active !== false &&
    item.category === category &&
    SUPPORTED_CATEGORIES.has(item.category) &&
    typeof item.id === 'string' &&
    item.id.trim() &&
    typeof item.title === 'string' &&
    item.title.trim() &&
    validSlot(item.slot_index)
  );
}

export function selectHomeContent(rows, category, limit = WEB_HOME_SECTION_LIMIT) {
  if (!Array.isArray(rows) || !SUPPORTED_CATEGORIES.has(category)) return [];
  const seen = new Set();
  return rows
    .filter((item) => isCanonicalHomeContent(item, category))
    .sort((a, b) => a.slot_index - b.slot_index || String(a.id).localeCompare(String(b.id)))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, Math.max(0, Number.isInteger(limit) ? limit : WEB_HOME_SECTION_LIMIT));
}

export function createHomeDetailUrl(item) {
  if (!isCanonicalHomeContent(item, item?.category)) return '';
  return `detail.html?${new URLSearchParams({ category: item.category, slot: String(item.slot_index) })}`;
}

export function homeContentYear(item) {
  const explicitYear = String(item?.year ?? '').trim();
  if (/^(?:19|20)\d{2}$/.test(explicitYear)) return explicitYear;
  for (const field of ['published_at', 'release_date', 'publish_date', 'created_at']) {
    const value = item?.[field];
    if (typeof value !== 'string' || !value) continue;
    const year = new Date(value).getUTCFullYear();
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) return String(year);
  }
  return '';
}

export function homeContentLabel(item) {
  const tags = Array.isArray(item?.theme_tags)
    ? item.theme_tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 2)
    : [];
  return tags.join(' · ') || (item?.category === 'manga' ? '漫画' : '动漫');
}
