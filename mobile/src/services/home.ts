import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { isContentItem, type ContentItem } from '../types/content';
import { isValidSocialUrl, parseSocialSettings, type SocialKey } from './social-links';

export const WEB_HOME_BANNER_SLOTS = 3;
export const MOBILE_HOME_SECTION_LIMIT = 4;

export interface HomeContentItem extends ContentItem {
  likeCount: number;
}

export interface HomeBannerItem extends ContentItem {
  linkedContent?: ContentItem;
}

export interface SocialLink {
  key: SocialKey;
  label: string;
  href: string;
}

export interface HomeData {
  banners: HomeBannerItem[];
  popular: HomeContentItem[];
  recommendations: HomeContentItem[];
  updates: HomeContentItem[];
  ranking: HomeContentItem[];
  news: HomeContentItem[];
  socialLinks: SocialLink[];
}

export function contentTimestamp(item: ContentItem): number {
  for (const field of ['updated_at', 'published_at', 'release_date', 'publish_date', 'created_at'] as const) {
    const timestamp = Date.parse(item[field] || '');
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

export function contentYear(item: ContentItem): string {
  const explicit = String(item.year ?? '').trim();
  if (/^(?:19|20)\d{2}$/.test(explicit)) return explicit;
  for (const field of ['published_at', 'release_date', 'publish_date', 'created_at'] as const) {
    const value = item[field];
    if (!value) continue;
    const year = new Date(value).getUTCFullYear();
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) return String(year);
  }
  return '--';
}

export function contentLabel(item: ContentItem): string {
  const tags = normalizeContentTags(item);
  return tags.join(' · ') || (item.category === 'manga' ? '漫画' : '动漫');
}

export function normalizeContentTags(item: ContentItem, limit = 2): string[] {
  if (!Array.isArray(item.theme_tags)) return [];
  const seen = new Set<string>();
  return item.theme_tags
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.normalize('NFKC').toLocaleLowerCase('zh-CN');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, Number.isInteger(limit) ? limit : 2));
}

export function isCanonicalContent(item: unknown, category: 'anime' | 'manga'): item is ContentItem {
  return Boolean(
    isContentItem(item) &&
      item.category === category &&
      item.is_active !== false &&
      item.id.trim() &&
      item.title.trim() &&
      item.slot_index >= 0 &&
      item.slot_index <= 999
  );
}

export const isCanonicalHomeContent = isCanonicalContent;

export function selectCanonicalContent(rows: unknown, category: 'anime' | 'manga'): ContentItem[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows
    .filter((item): item is ContentItem => isCanonicalContent(item, category))
    .sort((a, b) => a.slot_index - b.slot_index || a.id.localeCompare(b.id))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export function selectHomeContent(
  rows: unknown,
  category: 'anime' | 'manga',
  limit = MOBILE_HOME_SECTION_LIMIT
): ContentItem[] {
  return selectCanonicalContent(rows, category).slice(
    0,
    Math.max(0, Number.isInteger(limit) ? limit : MOBILE_HOME_SECTION_LIMIT)
  );
}

export function contentRoute(item: ContentItem | HomeBannerItem): string {
  if (!['anime', 'manga', 'banner'].includes(item.category)) return '';
  if (item.category === 'banner') {
    const linked = (item as HomeBannerItem).linkedContent;
    if (linked && ['anime', 'manga'].includes(linked.category)) return `/${linked.category}/${linked.id}`;
    return `/banner/${item.slot_index}/${item.id}`;
  }
  if (item.category !== 'anime' && item.category !== 'manga') return '';
  if (!isCanonicalContent(item, item.category)) return '';
  return `/${item.category}/${item.id}`;
}

export function storageImageKey(value?: string | null): string | null {
  const raw = String(value || '')
    .trim()
    .split('#', 1)[0]
    .split('?', 1)[0];
  const match = raw.match(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (!match) return null;
  const bucket = match[1].toLowerCase();
  const path = match[2].replace(/^\/+|\/+$/g, '');
  const key = `${bucket}/${path}`;
  return key.length <= 2048 ? key : null;
}

export function mapWebBanners(rows: unknown): ContentItem[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isContentItem)
    .filter(
      (item) =>
        item.category === 'banner' &&
        item.is_active !== false &&
        item.slot_index >= 0 &&
        item.slot_index < WEB_HOME_BANNER_SLOTS
    )
    .sort((a, b) => a.slot_index - b.slot_index || a.id.localeCompare(b.id))
    .slice(0, WEB_HOME_BANNER_SLOTS);
}

export function mapSocialLinks(value: unknown): SocialLink[] {
  return parseSocialSettings(value).flatMap((item) => {
    if (!item.enabled || !item.url || !isValidSocialUrl(item.url, item.key)) return [];
    try {
      const url = new URL(item.url);
      return ['https:', 'http:'].includes(url.protocol) ? [{ key: item.key, label: item.label, href: url.href }] : [];
    } catch {
      return [];
    }
  });
}

export function buildHomeData(
  bannerRows: unknown,
  catalogRows: unknown,
  likeCounts: ReadonlyMap<string, number> = new Map(),
  socialConfig?: unknown
): HomeData {
  const records = Array.isArray(catalogRows) ? catalogRows : [];
  const anime = selectHomeContent(records, 'anime', Number.MAX_SAFE_INTEGER);
  const manga = selectHomeContent(records, 'manga', Number.MAX_SAFE_INTEGER);
  const canonicalCatalog = [...anime, ...manga];
  const catalog = canonicalCatalog.map((item) => ({
    ...item,
    likeCount: (() => {
      const value = Number(likeCounts.get(storageImageKey(item.cover_url) ?? '') ?? 0);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    })()
  }));
  const byNewest = (a: HomeContentItem, b: HomeContentItem) => contentTimestamp(b) - contentTimestamp(a);
  return {
    banners: mapWebBanners(bannerRows).map((banner) => {
      const linkedContent = canonicalCatalog.find((item) => item.id === banner.linked_content_id);
      return linkedContent ? { ...banner, linkedContent } : banner;
    }),
    popular: catalog.filter((item) => item.category === 'anime').slice(0, MOBILE_HOME_SECTION_LIMIT),
    recommendations: catalog.filter((item) => item.category === 'manga').slice(0, MOBILE_HOME_SECTION_LIMIT),
    updates: [...catalog].sort(byNewest).slice(0, 6),
    ranking: [...catalog]
      .sort((a, b) => b.likeCount - a.likeCount || catalog.indexOf(a) - catalog.indexOf(b))
      .slice(0, 5),
    news: [...catalog].sort(byNewest).slice(0, 4),
    socialLinks: mapSocialLinks(socialConfig)
  };
}

async function fetchLikeCounts(client: SupabaseClient, rows: unknown): Promise<Map<string, number>> {
  if (!Array.isArray(rows)) return new Map();
  const keys = [
    ...new Set(
      rows
        .filter(isContentItem)
        .map((item) => storageImageKey(item.cover_url))
        .filter((key): key is string => Boolean(key))
    )
  ].slice(0, 100);
  if (!keys.length) return new Map();
  const { data, error } = await client.rpc('get_image_like_summary', {
    p_image_keys: keys,
    p_anonymous_id: null
  });
  if (error || !Array.isArray(data)) return new Map();
  return new Map(
    data.flatMap((row: unknown) => {
      if (!row || typeof row !== 'object') return [];
      const value = row as Record<string, unknown>;
      if (typeof value.image_key !== 'string') return [];
      return [[value.image_key, Number(value.like_count) || 0] as const];
    })
  );
}

export async function fetchItemLikeCounts(rows: ContentItem[], client?: SupabaseClient): Promise<Map<string, number>> {
  const counts = await fetchLikeCounts(client ?? (await getSupabase()), rows);
  return new Map(rows.map((item) => [item.id, counts.get(storageImageKey(item.cover_url) ?? '') ?? 0]));
}

export async function fetchHomeData(client?: SupabaseClient): Promise<HomeData> {
  const supabase = client ?? (await getSupabase());
  const socialRequest = Promise.resolve()
    .then(() => supabase.from('site_config').select('url').eq('section', 'social_links').maybeSingle())
    .catch((error: unknown) => ({ data: null, error }));
  const [bannerResult, catalogResult, socialResult] = await Promise.all([
    supabase
      .from('content_management')
      .select('*')
      .eq('category', 'banner')
      .order('slot_index', { ascending: true }),
    supabase.from('content_management').select('*'),
    socialRequest
  ]);
  if (bannerResult.error) throw bannerResult.error;
  if (catalogResult.error) throw catalogResult.error;
  const likeCounts = await fetchLikeCounts(supabase, catalogResult.data);
  return buildHomeData(
    bannerResult.data,
    catalogResult.data,
    likeCounts,
    socialResult.error ? undefined : socialResult.data?.url
  );
}
