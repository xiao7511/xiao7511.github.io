import { apiOrigin } from './config';
import { ApiError, fetchJson } from './http';
import { isContentItem, type ContentItem } from '../types/content';

export async function fetchContent(path: 'recommend' | 'manga'): Promise<ContentItem[]> {
  const payload = await fetchJson(`${apiOrigin()}/api/${path}`);
  if (!Array.isArray(payload)) throw new ApiError('INVALID_RESPONSE', '内容格式无效');
  return payload.filter(isContentItem);
}

export async function fetchContentDetail(category: 'anime' | 'manga' | 'banner', slot: number): Promise<ContentItem> {
  const query = new URLSearchParams({ category, slot: String(slot) });
  const payload = await fetchJson(`${apiOrigin()}/api/detail?${query}`);
  if (!isContentItem(payload) || payload.category !== category || payload.slot_index !== slot) {
    throw new ApiError('INVALID_RESPONSE', '详情格式无效');
  }
  return payload;
}
