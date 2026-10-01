import { isCanonicalContent } from './content.js';

export const WEB_HOME_BANNER_SLOTS = 3;
export const BANNER_FALLBACK_URL = 'recommend.html';

function validSlot(value) {
  return Number.isInteger(value) && value >= 0 && value < 1000;
}

export function createContentDetailUrl(item) {
  if (!item || !['anime', 'manga'].includes(item.category) || !isCanonicalContent(item, item.category)) return '';
  return `detail.html?${new URLSearchParams({
    category: item.category,
    slot: String(item.slot_index)
  })}`;
}

export function applyBannerCtaTargets(actions, value) {
  const href =
    typeof value === 'string' &&
    (value === BANNER_FALLBACK_URL || /^detail\.html\?category=(?:anime|manga)&slot=\d{1,3}$/.test(value))
      ? value
      : BANNER_FALLBACK_URL;
  actions.filter(Boolean).forEach((action) => {
    action.href = href;
  });
  return href;
}

export function mapActiveBanners(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (item) =>
        item &&
        item.category === 'banner' &&
        item.is_active !== false &&
        Number.isInteger(item.slot_index) &&
        item.slot_index >= 0 &&
        item.slot_index < WEB_HOME_BANNER_SLOTS
    )
    .sort((a, b) => a.slot_index - b.slot_index || String(a.id || '').localeCompare(String(b.id || '')))
    .slice(0, WEB_HOME_BANNER_SLOTS);
}

export function resolveBannerItems(bannerRows, catalogRows) {
  const catalog = Array.isArray(catalogRows) ? catalogRows : [];
  return mapActiveBanners(bannerRows).map((banner) => {
    const linkedContent = catalog.find(
      (item) =>
        item &&
        item.id === banner.linked_content_id &&
        ['anime', 'manga'].includes(item.category) &&
        isCanonicalContent(item, item.category)
    );
    const detailUrl = createContentDetailUrl(linkedContent);
    return {
      ...banner,
      linkedContent: detailUrl ? linkedContent : undefined,
      detailUrl: detailUrl || BANNER_FALLBACK_URL
    };
  });
}
