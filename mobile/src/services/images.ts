const siteOrigin = 'https://www.nobistudio.com';

export function contentImageUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const trimmed = raw.trim().replace(/^(?:\.\/|\/)+/, '');
    const clean = trimmed.replace(/^images\/images\//, 'images/');
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : clean, siteOrigin + '/');
    if (url.protocol !== 'https:') return undefined;
    const trusted = ['nobistudio.com', 'www.nobistudio.com', 'api.nobistudio.com'].includes(url.hostname) || url.hostname.endsWith('.supabase.co');
    return trusted ? url.href : undefined;
  } catch {
    return undefined;
  }
}
