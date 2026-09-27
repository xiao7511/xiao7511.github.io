import { apiOrigin } from './config';
import { fetchJson } from './http';
import { isContentItem, type ContentItem } from '../types/content';

export async function fetchContent(path: 'recommend' | 'manga'): Promise<ContentItem[]> {
  const payload = await fetchJson(`${apiOrigin()}/api/${path}`);
  if (!Array.isArray(payload)) throw new Error('内容格式无效');
  return payload.filter(isContentItem);
}
