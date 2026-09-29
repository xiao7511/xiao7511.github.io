import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentItem } from '../types/content';
import { storageImageKey } from './home';

export interface ImageLikeTarget {
  contentId: string;
  imageKey: string;
  kind: 'banner' | 'cover' | 'detail';
  index: number;
}

export function contentDetailLikeTargets(item: ContentItem): ImageLikeTarget[] {
  return (item.detail_urls ?? []).flatMap((url, index) => {
    const imageKey = storageImageKey(url);
    return imageKey ? [{ contentId: item.id, imageKey, kind: 'detail' as const, index }] : [];
  });
}

export interface ImageLikeSummary {
  count: number;
  liked: boolean;
}

export function contentCoverLikeTarget(item: ContentItem): ImageLikeTarget | null {
  const imageKey = storageImageKey(item.cover_url);
  if (!imageKey) return null;
  return {
    contentId: item.id,
    imageKey,
    kind: item.category === 'banner' ? 'banner' : 'cover',
    index: 0
  };
}

export async function fetchImageLikeSummaries(
  client: SupabaseClient,
  items: ContentItem[]
): Promise<Map<string, ImageLikeSummary>> {
  return fetchImageLikeTargetSummaries(
    client,
    items.map(contentCoverLikeTarget).filter((target): target is ImageLikeTarget => Boolean(target))
  );
}

export async function fetchImageLikeTargetSummaries(
  client: SupabaseClient,
  targets: ImageLikeTarget[]
): Promise<Map<string, ImageLikeSummary>> {
  const keys = [...new Set(targets.map((target) => target.imageKey))].slice(0, 100);
  if (!keys.length) return new Map();
  const result = await client.rpc('get_image_like_summary', { p_image_keys: keys, p_anonymous_id: null });
  if (result.error) throw result.error;
  const rows = Array.isArray(result.data) ? result.data : [];
  return new Map(
    rows.flatMap((row: unknown) => {
      if (!row || typeof row !== 'object') return [];
      const value = row as Record<string, unknown>;
      if (typeof value.image_key !== 'string') return [];
      return [[value.image_key, { count: Number(value.like_count) || 0, liked: value.liked === true }] as const];
    })
  );
}

export async function toggleContentImageLike(
  client: SupabaseClient,
  target: ImageLikeTarget
): Promise<ImageLikeSummary> {
  const result = await client.rpc('toggle_image_like', {
    p_content_id: target.contentId,
    p_image_kind: target.kind,
    p_image_index: target.index,
    p_image_key: target.imageKey,
    p_anonymous_id: null
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || typeof row !== 'object') throw new Error('INVALID_IMAGE_LIKE_RESPONSE');
  const value = row as Record<string, unknown>;
  return { count: Number(value.like_count) || 0, liked: value.liked === true };
}
