export const SOCIAL_KEYS = ['xiaohongshu', 'weibo', 'twitter', 'instagram'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface SocialSetting {
  key: SocialKey;
  label: string;
  url: string;
  enabled: boolean;
  order: number;
}

const labels: Record<SocialKey, string> = {
  xiaohongshu: '小红书',
  weibo: '微博',
  twitter: 'X / Twitter',
  instagram: 'Instagram'
};

export function isValidSocialUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseSocialSettings(value: unknown): SocialSetting[] {
  let config: Record<string, unknown> = {};
  try {
    const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed as Record<string, unknown>;
  } catch {
    config = {};
  }
  const enabled =
    config._enabled && typeof config._enabled === 'object' ? (config._enabled as Record<string, unknown>) : {};
  const requestedOrder = Array.isArray(config._order) ? config._order : [];
  const validOrder = [
    ...new Set(requestedOrder.filter((key): key is SocialKey => SOCIAL_KEYS.includes(key as SocialKey)))
  ];
  const order = [...validOrder, ...SOCIAL_KEYS.filter((key) => !validOrder.includes(key))];
  return order.map((key, index) => ({
    key,
    label: labels[key],
    url: typeof config[key] === 'string' ? config[key].trim() : '',
    enabled: enabled[key] === undefined ? Boolean(config[key]) : enabled[key] === true,
    order: index
  }));
}

export function serializeSocialSettings(settings: SocialSetting[]): string {
  const sorted = [...settings].sort((a, b) => a.order - b.order);
  const config: Record<string, unknown> = {
    _enabled: Object.fromEntries(sorted.map((item) => [item.key, item.enabled])),
    _order: sorted.map((item) => item.key)
  };
  for (const item of sorted) config[item.key] = item.url.trim();
  return JSON.stringify(config);
}
