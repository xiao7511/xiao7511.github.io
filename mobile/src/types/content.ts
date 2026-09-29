export interface ContentItem {
  id: string;
  category: string;
  slot_index: number;
  title: string;
  subtitle?: string | null;
  cover_url?: string | null;
  detail_urls?: string[] | null;
  theme_tags?: string[] | null;
  year?: string | number | null;
  published_at?: string | null;
  release_date?: string | null;
  publish_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  region?: string | null;
  description?: string | null;
  is_active?: boolean;
  linked_content_id?: string | null;
}

export function isContentItem(value: unknown): value is ContentItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.category === 'string' &&
    Number.isInteger(item.slot_index)
  );
}
