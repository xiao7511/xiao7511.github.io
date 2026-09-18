const TRUSTED_IMAGE_HOSTS = new Set([location.hostname, 'api.dicebear.com', 'www.nobistudio.com', 'nobistudio.com']);

export function safeImageUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''), location.href);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const trusted = TRUSTED_IMAGE_HOSTS.has(url.hostname) || url.hostname.endsWith('.supabase.co');
    return (url.protocol === 'https:' || (local && url.protocol === 'http:')) && trusted ? url.href : fallback;
  } catch (_) {
    return fallback;
  }
}

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
  const source = safeImageUrl(value, fallback);
  if (source) image.src = source;
  else image.removeAttribute('src');
  return Boolean(source);
}

export function setMessage(container, message, style = '') {
  container.replaceChildren(element('div', { text: message, style }));
}
