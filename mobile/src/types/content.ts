export interface ContentItem {
  id: string;
  category: string;
  slot_index: number;
  title: string;
  subtitle?: string | null;
  cover_url?: string | null;
  theme_tags?: string[] | null;
  year?: number | string | null;
  banner_url?: string | null;
}

export function isContentItem(value: unknown): value is ContentItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.title === 'string' && typeof item.category === 'string' && Number.isInteger(item.slot_index);
}
