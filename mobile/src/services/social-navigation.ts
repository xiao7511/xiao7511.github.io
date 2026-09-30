import { isValidSocialUrl, type SocialKey } from './social-links';

export function openSocialLink(url: string, platform: SocialKey): boolean {
  if (!isValidSocialUrl(url, platform) || !url.trim()) return false;
  try {
    return Boolean(globalThis.open(url.trim(), '_blank', 'noopener,noreferrer'));
  } catch {
    return false;
  }
}
