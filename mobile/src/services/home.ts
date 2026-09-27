import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { isContentItem, type ContentItem } from '../types/content';

export const WEB_HOME_BANNER_SLOTS = 3;

export interface HomeContentItem extends ContentItem {
  likeCount: number;
}

export interface SocialLink {
  key: 'xiaohongshu' | 'weibo' | 'twitter' | 'instagram';
  label: string;
  href: string;
}

export interface HomeData {
  banners: ContentItem[];
  popular: HomeContentItem[];
  recommendations: HomeContentItem[];
  updates: HomeContentItem[];
  ranking: HomeContentItem[];
  news: HomeContentItem[];
  socialLinks: SocialLink[];
}

const socialLabels: Record<SocialLink['key'], string> = {
  xiaohongshu: '小红书',
  weibo: '微博',
  twitter: 'X / Twitter',
  instagram: 'Instagram'
};

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
  const tags = (item.theme_tags ?? []).filter(Boolean).slice(0, 2);
  return tags.join(' · ') || (item.category === 'manga' ? '漫画' : '动漫');
}

export function contentRoute(item: ContentItem): string {
  if (!['anime', 'manga', 'banner'].includes(item.category)) return '';
  if (item.category === 'banner') return `/banner/${item.slot_index}/${item.id}`;
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
        item.category === 'banner' && item.slot_index >= 0 && item.slot_index < WEB_HOME_BANNER_SLOTS
    )
    .sort((a, b) => a.slot_index - b.slot_index)
    .slice(0, WEB_HOME_BANNER_SLOTS);
}

export function mapSocialLinks(value: unknown): SocialLink[] {
  try {
    const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return (Object.keys(socialLabels) as SocialLink['key'][]).flatMap((key) => {
      const raw = (parsed as Record<string, unknown>)[key];
      if (typeof raw !== 'string') return [];
      try {
        const url = new URL(raw);
        if (!['https:', 'http:'].includes(url.protocol)) return [];
        return [{ key, label: socialLabels[key], href: url.href }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function buildHomeData(
  bannerRows: unknown,
  catalogRows: unknown,
  likeCounts: ReadonlyMap<string, number> = new Map(),
  socialConfig?: unknown
): HomeData {
  const records = Array.isArray(catalogRows) ? catalogRows.filter(isContentItem) : [];
  const anime = records.filter((item) => item.category === 'anime').sort((a, b) => a.slot_index - b.slot_index);
  const manga = records.filter((item) => item.category === 'manga').sort((a, b) => a.slot_index - b.slot_index);
  const catalog = [...anime, ...manga].map((item) => ({
    ...item,
    likeCount: [
      ...new Set((item.detail_urls ?? []).map(storageImageKey).filter((key): key is string => Boolean(key)))
    ].reduce((total, key) => total + (likeCounts.get(key) ?? 0), 0)
  }));
  const byNewest = (a: HomeContentItem, b: HomeContentItem) => contentTimestamp(b) - contentTimestamp(a);
  return {
    banners: mapWebBanners(bannerRows),
    popular: catalog.filter((item) => item.category === 'anime').slice(0, 6),
    recommendations: catalog.filter((item) => item.category === 'manga').slice(0, 6),
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
        .flatMap((item) => item.detail_urls ?? [])
        .map(storageImageKey)
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

export async function fetchItemLikeCounts(
  rows: ContentItem[],
  client?: SupabaseClient
): Promise<Map<string, number>> {
  const counts = await fetchLikeCounts(client ?? (await getSupabase()), rows);
  return new Map(
    rows.map((item) => [
      item.id,
      [...new Set((item.detail_urls ?? []).map(storageImageKey).filter((key): key is string => Boolean(key)))].reduce(
        (total, key) => total + (counts.get(key) ?? 0),
        0
      )
    ])
  );
}

export async function fetchHomeData(client?: SupabaseClient): Promise<HomeData> {
  const supabase = client ?? (await getSupabase());
  const [bannerResult, catalogResult, socialResult] = await Promise.all([
    supabase.from('content_management').select('*').eq('category', 'banner').order('slot_index', { ascending: true }),
    supabase.from('content_management').select('*'),
    supabase.from('site_config').select('url').eq('section', 'social_links').maybeSingle()
  ]);
  if (bannerResult.error) throw bannerResult.error;
  if (catalogResult.error) throw catalogResult.error;
  const likeCounts = await fetchLikeCounts(supabase, catalogResult.data);
  return buildHomeData(bannerResult.data, catalogResult.data, likeCounts, socialResult.error ? undefined : socialResult.data?.url);
}
