(function () {
  'use strict';

  const TRUSTED_IMAGE_HOSTS = new Set([
    window.location.hostname,
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

  function isTrustedImageHost(hostname) {
    return TRUSTED_IMAGE_HOSTS.has(hostname) || hostname.endsWith('.supabase.co');
  }

  function safeImageUrl(value, fallback = '') {
    try {
      const url = new URL(String(value || ''), window.location.href);
      const localDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if ((url.protocol !== 'https:' && !localDevelopment) || !isTrustedImageHost(url.hostname)) return fallback;
      return url.href;
    } catch (_) {
      return fallback;
    }
  }

  function setImageSource(image, value, fallback = '') {
    const fallbackUrl = safeImageUrl(fallback);
    const safeUrl = safeImageUrl(value, fallbackUrl);
    image.onerror = null;
    if (safeUrl) {
      if (fallbackUrl && safeUrl !== fallbackUrl) {
        image.onerror = () => {
          image.onerror = null;
          image.src = fallbackUrl;
        };
      }
      image.src = safeUrl;
    } else {
      image.removeAttribute('src');
    }
    return Boolean(safeUrl);
  }

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = String(options.text);
    if (options.id) node.id = options.id;
    if (options.style) node.style.cssText = options.style;
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    }
    for (const child of children) if (child) node.append(child);
    return node;
  }

  function setMessage(container, message, style = '') {
    if (!container) return;
    container.replaceChildren(element('div', { text: message, style }));
  }

  window.SecurityUtils = Object.freeze({ element, safeImageUrl, setImageSource, setMessage });
}());
