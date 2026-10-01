export const SOCIAL_KEYS = ['xiaohongshu', 'weibo', 'x', 'instagram'];

export const SOCIAL_LABELS = {
  xiaohongshu: '小红书',
  weibo: '微博',
  x: 'X',
  instagram: 'Instagram'
};

const ALIASES = {
  xiaohongshu: ['小红书'],
  weibo: ['微博'],
  x: ['twitter', 'x / twitter', 'X', 'Twitter'],
  instagram: []
};

const HOSTS = {
  xiaohongshu: ['xiaohongshu.com', 'xhslink.com', 'xhslink.cn'],
  weibo: ['weibo.com', 'weibo.cn'],
  x: ['x.com', 'twitter.com'],
  instagram: ['instagram.com']
};

export function canonicalSocialKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US');
  return SOCIAL_KEYS.find(
    (key) => key === normalized || ALIASES[key].some((alias) => alias.toLocaleLowerCase('en-US') === normalized)
  );
}

export function isValidSocialUrl(value, platform) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return true;
  if (['null', 'undefined'].includes(normalized.toLocaleLowerCase('en-US'))) return false;
  try {
    const url = new URL(normalized);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return false;
    const key = canonicalSocialKey(platform);
    return !key || HOSTS[key].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseConfig(value) {
  try {
    return objectValue(typeof value === 'string' ? JSON.parse(value) : value);
  } catch {
    return {};
  }
}

function findValue(config, key) {
  if (Object.hasOwn(config, key)) return config[key];
  for (const alias of ALIASES[key]) {
    const entry = Object.entries(config).find(
      ([candidate]) => candidate.toLocaleLowerCase('en-US') === alias.toLocaleLowerCase('en-US')
    );
    if (entry) return entry[1];
  }
  return undefined;
}

function normalizeOrder(value) {
  const requested = Array.isArray(value) ? value.map(canonicalSocialKey).filter(Boolean) : [];
  return [...new Set([...requested, ...SOCIAL_KEYS])];
}

export function parseSocialSettings(value) {
  const config = parseConfig(value);
  const enabled = objectValue(config._enabled);
  const settings = normalizeOrder(config._order).map((key, order) => {
    const urlValue = findValue(config, key);
    const enabledValue = findValue(enabled, key);
    const url = typeof urlValue === 'string' ? urlValue.trim() : '';
    return {
      key,
      label: SOCIAL_LABELS[key],
      url,
      enabled: enabledValue === undefined ? Boolean(url) : enabledValue === true,
      order
    };
  });
  const known = new Set(['_enabled', '_order']);
  SOCIAL_KEYS.forEach((key) => {
    known.add(key);
    ALIASES[key].forEach((alias) => known.add(alias.toLocaleLowerCase('en-US')));
  });
  const extras = Object.fromEntries(
    Object.entries(config).filter(([key]) => !known.has(key.toLocaleLowerCase('en-US')))
  );
  settings.extras = extras;
  settings.enabledExtras = Object.fromEntries(Object.entries(enabled).filter(([key]) => !canonicalSocialKey(key)));
  return settings;
}

export function serializeSocialSettings(settings) {
  const sorted = [...settings].sort((a, b) => a.order - b.order);
  const config = {
    ...(settings.extras || {}),
    _enabled: {
      ...(settings.enabledExtras || {}),
      ...Object.fromEntries(sorted.map((item) => [item.key, item.enabled === true]))
    },
    _order: sorted.map((item) => item.key)
  };
  sorted.forEach((item) => {
    config[item.key] = typeof item.url === 'string' ? item.url.trim() : '';
  });
  return JSON.stringify(config);
}
