export const SOCIAL_KEYS = ['xiaohongshu', 'weibo', 'x', 'instagram'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface SocialSetting {
  key: SocialKey;
  label: string;
  url: string;
  enabled: boolean;
  order: number;
}

export type SocialSettings = SocialSetting[] & {
  extras?: Record<string, unknown>;
  enabledExtras?: Record<string, unknown>;
};

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  xiaohongshu: '小红书',
  weibo: '微博',
  x: 'X',
  instagram: 'Instagram'
};

const aliases: Record<SocialKey, string[]> = {
  xiaohongshu: ['小红书'],
  weibo: ['微博'],
  x: ['twitter', 'x / twitter', 'X', 'Twitter'],
  instagram: []
};

const hosts: Record<SocialKey, string[]> = {
  xiaohongshu: ['xiaohongshu.com', 'xhslink.com'],
  weibo: ['weibo.com', 'weibo.cn'],
  x: ['x.com', 'twitter.com'],
  instagram: ['instagram.com']
};

export function canonicalSocialKey(value: unknown): SocialKey | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US');
  return SOCIAL_KEYS.find(
    (key) => key === normalized || aliases[key].some((alias) => alias.toLocaleLowerCase('en-US') === normalized)
  );
}

export function isValidSocialUrl(value: unknown, platform?: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return true;
  if (['null', 'undefined'].includes(normalized.toLocaleLowerCase('en-US'))) return false;
  try {
    const url = new URL(normalized);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return false;
    const key = canonicalSocialKey(platform);
    return !key || hosts[key].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseConfig(value: unknown): Record<string, unknown> {
  try {
    return record(typeof value === 'string' ? (JSON.parse(value) as unknown) : value);
  } catch {
    return {};
  }
}

function findValue(config: Record<string, unknown>, key: SocialKey): unknown {
  if (Object.hasOwn(config, key)) return config[key];
  for (const alias of aliases[key]) {
    const entry = Object.entries(config).find(
      ([candidate]) => candidate.toLocaleLowerCase('en-US') === alias.toLocaleLowerCase('en-US')
    );
    if (entry) return entry[1];
  }
  return undefined;
}

function normalizeOrder(value: unknown): SocialKey[] {
  const requested = Array.isArray(value)
    ? value.map(canonicalSocialKey).filter((key): key is SocialKey => Boolean(key))
    : [];
  return [...new Set([...requested, ...SOCIAL_KEYS])];
}

export function parseSocialSettings(value: unknown): SocialSettings {
  const config = parseConfig(value);
  const enabled = record(config._enabled);
  const settings = normalizeOrder(config._order).map((key, index) => {
    const urlValue = findValue(config, key);
    const enabledValue = findValue(enabled, key);
    const url = typeof urlValue === 'string' ? urlValue.trim() : '';
    return {
      key,
      label: SOCIAL_LABELS[key],
      url,
      enabled: enabledValue === undefined ? Boolean(url) : enabledValue === true,
      order: index
    };
  }) as SocialSettings;
  const known = new Set(['_enabled', '_order']);
  SOCIAL_KEYS.forEach((key) => {
    known.add(key);
    aliases[key].forEach((alias) => known.add(alias.toLocaleLowerCase('en-US')));
  });
  settings.extras = Object.fromEntries(
    Object.entries(config).filter(([key]) => !known.has(key.toLocaleLowerCase('en-US')))
  );
  settings.enabledExtras = Object.fromEntries(Object.entries(enabled).filter(([key]) => !canonicalSocialKey(key)));
  return settings;
}

export function serializeSocialSettings(settings: SocialSettings): string {
  const sorted = [...settings].sort((a, b) => a.order - b.order);
  const config: Record<string, unknown> = {
    ...(settings.extras || {}),
    _enabled: {
      ...(settings.enabledExtras || {}),
      ...Object.fromEntries(sorted.map((item) => [item.key, item.enabled === true]))
    },
    _order: sorted.map((item) => item.key)
  };
  for (const item of sorted) config[item.key] = typeof item.url === 'string' ? item.url.trim() : '';
  return JSON.stringify(config);
}
