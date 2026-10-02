export function publicVideoUrl(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && /\.(?:mp4|webm)$/i.test(url.pathname)
      ? url.href
      : '';
  } catch {
    return '';
  }
}
