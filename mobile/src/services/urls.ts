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

export function safeShareUrl(raw?: string | null): string | undefined {
  const safe = safeExternalUrl(raw);
  if (!safe) return undefined;
  const url = new URL(safe);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return undefined;
  return url.href;
}

export function contentWebUrl(category: 'anime' | 'manga', slot: number): string {
  const query = new URLSearchParams({ category, slot: String(slot) });
  return `${webOrigin()}/detail.html?${query}`;
}

export function communityWebUrl(): string {
  return `${webOrigin()}/community.html`;
}
