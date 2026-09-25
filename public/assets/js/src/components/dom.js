const TRUSTED_IMAGE_HOSTS = new Set([
  location.hostname,
  'api.dicebear.com',
  'api.nobistudio.com',
  'www.nobistudio.com',
  'nobistudio.com'
]);

for (const origin of [window.SiteConfig?.siteOrigin, window.SiteConfig?.apiOrigin]) {
  try {
    if (origin) TRUSTED_IMAGE_HOSTS.add(new URL(origin).hostname);
  } catch (_) {
    // Invalid runtime origins are ignored and will never be trusted as image sources.
  }
}

export function normalizeImageUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''), location.href);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const trusted = TRUSTED_IMAGE_HOSTS.has(url.hostname) || url.hostname.endsWith('.supabase.co');
    return (url.protocol === 'https:' || (local && url.protocol === 'http:')) && trusted ? url.href : fallback;
  } catch (_) {
    return fallback;
  }
}

export const safeImageUrl = normalizeImageUrl;

export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.style) node.style.cssText = options.style;
  for (const [name, value] of Object.entries(options.attributes || {})) node.setAttribute(name, String(value));
  node.append(...children.filter(Boolean));
  return node;
}

export function setImageSource(image, value, fallback = '') {
  const fallbackSource = safeImageUrl(fallback);
  const source = safeImageUrl(value, fallbackSource);
  image.onerror = null;
  if (source) {
    if (fallbackSource && source !== fallbackSource) {
      image.onerror = () => {
        image.onerror = null;
        image.src = fallbackSource;
      };
    }
    image.src = source;
  } else {
    image.removeAttribute('src');
  }
  return Boolean(source);
}

export function setMessage(container, message, style = '') {
  container.replaceChildren(element('div', { text: message, style }));
}

export function createSkeletonList(count = 4, variant = 'card') {
  return Array.from({ length: count }, () =>
    element('div', { className: `skeleton skeleton--${variant}`, attributes: { 'aria-hidden': 'true' } })
  );
}

export function setLoadingState(container, { count = 4, variant = 'card', label = '正在加载内容' } = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(
    ...createSkeletonList(count, variant),
    element('span', { className: 'sr-only', text: label })
  );
}

export function setContentState(container, { message, kind = 'empty', retryLabel = '重试', onRetry } = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'false');
  const children = [element('p', { text: message || '暂无内容' })];
  if (typeof onRetry === 'function') {
    const retry = element('button', { className: 'button button--secondary state__action', text: retryLabel });
    retry.addEventListener('click', onRetry, { once: true });
    children.push(retry);
  }
  container.replaceChildren(element('div', { className: `content-state content-state--${kind}` }, children));
}

export function setState(container, { title, message, retry } = {}) {
  if (!container) return;
  container.setAttribute('aria-busy', 'false');
  const children = [];
  if (title) children.push(element('h2', { className: 'state__title', text: title }));
  if (message) children.push(element('p', { text: message }));
  if (typeof retry === 'function') {
    const button = element('button', { className: 'button button--secondary state__action', text: '重试' });
    button.addEventListener('click', retry, { once: true });
    children.push(button);
  }
  container.replaceChildren(element('div', { className: 'state' }, children));
}
