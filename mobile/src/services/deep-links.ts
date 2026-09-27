import { safeInternalPath } from '../router/safe-navigation';

const WEB_HOSTS = new Set(['nobistudio.com', 'www.nobistudio.com']);
const CONTENT_PATH = /^\/(anime|manga)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;
const COMMUNITY_PATH = /^\/community\/([1-9][0-9]*)\/?$/;

export function deepLinkRoute(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !WEB_HOSTS.has(url.hostname.toLowerCase())) return null;

    const content = url.pathname.match(CONTENT_PATH);
    if (content) return safeInternalPath(`/${content[1].toLowerCase()}/${content[2].toLowerCase()}`);

    const community = url.pathname.match(COMMUNITY_PATH);
    if (community) return safeInternalPath(`/community/${community[1]}`);
    return null;
  } catch {
    return null;
  }
}
