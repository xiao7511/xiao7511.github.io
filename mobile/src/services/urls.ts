import { webOrigin } from './config';

export function safeExternalUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function contentWebUrl(category: 'anime' | 'manga', slot: number): string {
  const query = new URLSearchParams({ category, slot: String(slot) });
  return `${webOrigin()}/detail.html?${query}`;
}

export function communityWebUrl(): string {
  return `${webOrigin()}/community.html`;
}
