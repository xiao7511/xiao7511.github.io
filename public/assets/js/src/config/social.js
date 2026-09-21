export function isValidSocialUrl(value) {
  if (!String(value || '').trim()) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol);
  } catch (_) {
    return false;
  }
}
