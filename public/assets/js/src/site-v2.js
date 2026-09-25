import { initializeSupabase } from './api/supabase.js';
import { element, safeImageUrl, setImageSource } from './components/dom.js';
import { initSiteHeader } from './components/header.js';
import {
  getImageKey,
  imageTargetKey,
  isImageTarget,
  mapImageLikeSummaries,
  sumImageLikeCounts
} from './images/likes.js';

const DEFAULT_AVATAR = 'images/nobi-avatar.svg';
const SOCIAL_LABELS = {
  xiaohongshu: '小红书',
  weibo: '微博',
  twitter: 'X / Twitter',
  instagram: 'Instagram'
};
const SOCIAL_ICONS = {
  xiaohongshu:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z"/></svg>',
  weibo:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z"/></svg>',
  twitter:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.03.084c-1.277.06-2.149.264-2.911.563-.789.308-1.458.72-2.123 1.388C1.331 2.703.921 3.372.616 4.162.321 4.926.12 5.799.064 7.076.008 8.354-.005 8.764.001 12.023c.006 3.259.021 3.667.083 4.947.061 1.277.264 2.148.563 2.911.308.789.72 1.457 1.388 2.123.668.665 1.337 1.074 2.129 1.38.763.295 1.636.496 2.913.552 1.277.056 1.688.069 4.946.063 3.258-.006 3.668-.021 4.948-.081 1.28-.061 2.147-.265 2.91-.563.789-.309 1.458-.72 2.123-1.388.665-.668 1.075-1.338 1.38-2.128.295-.763.496-1.636.552-2.913.056-1.281.069-1.69.063-4.948-.006-3.258-.021-3.667-.082-4.946-.061-1.28-.264-2.149-.563-2.912-.308-.789-.72-1.457-1.388-2.123C21.298 1.33 20.628.921 19.838.617 19.074.321 18.202.12 16.924.065 15.647.009 15.236-.005 11.977.001 8.718.008 8.31.022 7.03.084m.14 21.693c-1.17-.051-1.805-.245-2.229-.408-.561-.216-.96-.477-1.382-.895-.422-.418-.681-.819-.9-1.378-.164-.423-.362-1.058-.417-2.228-.059-1.265-.072-1.644-.079-4.848-.007-3.204.005-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.476-.96.895-1.382.419-.422.818-.681 1.378-.9.423-.165 1.058-.361 2.227-.417 1.266-.06 1.645-.072 4.848-.079 3.203-.007 3.584.005 4.85.061 1.169.051 1.805.244 2.228.408.561.216.96.475 1.382.895.422.419.682.818.901 1.379.165.422.362 1.056.417 2.226.06 1.266.074 1.645.08 4.848.006 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.806-.408 2.229-.216.56-.476.96-.895 1.381-.419.422-.818.681-1.378.9-.422.165-1.058.362-2.226.417-1.266.06-1.645.072-4.849.079-3.205.007-3.583-.006-4.848-.061M16.953 5.586a1.44 1.44 0 1 0 1.437-1.442 1.44 1.44 0 0 0-1.437 1.442M5.839 12.012c.007 3.403 2.771 6.156 6.173 6.149 3.403-.006 6.157-2.77 6.151-6.173-.007-3.403-2.771-6.157-6.174-6.15-3.403.007-6.156 2.771-6.15 6.174M8 12.008a4 4 0 1 1 4.008 3.992A4 4 0 0 1 8 12.008"/></svg>'
};

let client;
let features = { analytics: false, imageLikes: false };
let likeRefreshTimer;
let lastLikeTargetSignature = '';

function createUuid(storage, key) {
  let value = storage.getItem(key);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) return value;
  value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

function parseJsonConfig(value, fallback = {}) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function renderSocialLinks(config) {
  document.querySelector('.footer-social')?.remove();
  const footerSlot = document.querySelector('.footer-social-slot');
  if (footerSlot) footerSlot.hidden = true;
  const links = Object.entries(SOCIAL_LABELS)
    .map(([key, label]) => ({ key, label, href: safeExternalUrl(config[key]) }))
    .filter((item) => item.href);
  if (!links.length) return;

  const copyright = document.querySelector('.site-footer .copyright');
  if (!footerSlot && !copyright) return;
  const dock = element('nav', { className: 'footer-social', attributes: { 'aria-label': 'NOBI 动漫社交媒体' } });
  links.forEach(({ key, label, href }) => {
    const anchor = element('a', {
      className: `footer-social__link footer-social__link--${key}`,
      attributes: {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': label,
        'data-social-platform': key,
        title: label
      }
    });
    anchor.innerHTML = SOCIAL_ICONS[key];
    if (key === 'instagram') {
      const instagramIcon = anchor.querySelector('svg');
      instagramIcon?.insertAdjacentHTML(
        'afterbegin',
        '<defs><linearGradient id="nobi-instagram-gradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd600"/><stop offset="0.35" stop-color="#ff7a00"/><stop offset="0.68" stop-color="#ff0169"/><stop offset="1" stop-color="#d300c5"/></linearGradient></defs>'
      );
      instagramIcon?.querySelector('path')?.style.setProperty('fill', 'url("#nobi-instagram-gradient")');
    }
    dock.append(anchor);
  });
  if (footerSlot) {
    footerSlot.append(dock);
    footerSlot.hidden = false;
  } else {
    copyright.before(dock);
  }
}

function getDetailUrl(image) {
  const value = image.dataset.detailUrl || image.closest('a[href]')?.getAttribute('href') || '';
  if (!value) return '';
  try {
    const url = new URL(value, location.href);
    const route = new URLSearchParams(url.search);
    const validPath = url.origin === location.origin && /(?:^|\/)detail\.html$/.test(url.pathname);
    const validCategory = ['anime', 'manga'].includes(route.get('category'));
    const validSlot = /^\d{1,3}$/.test(route.get('slot') || '');
    return validPath && validCategory && validSlot ? `${url.pathname.split('/').pop()}?${route}` : '';
  } catch (_) {
    return '';
  }
}

async function fetchProfile(user) {
  if (!user) return null;
  const { data } = await client.from('profiles').select('nickname,avatar_url').eq('id', user.id).maybeSingle();
  return data || null;
}

function renderAccountControl(user, profile) {
  const control = document.getElementById('user-btn') || document.querySelector('[data-account-link]');
  if (!control) return;
  const label = profile?.nickname || user?.email?.split('@')[0] || '';
  if (!user) {
    if (control.matches('a')) control.href = 'index.html?auth=login';
    control.replaceChildren(element('span', { className: 'account-control__label', text: '登录' }));
    control.classList.remove('is-authenticated');
    return;
  }
  if (control.matches('a')) control.href = 'index.html?account=profile';
  const image = element('img', {
    className: 'nav-avatar',
    attributes: { alt: '', width: '30', height: '30', decoding: 'async' }
  });
  setImageSource(image, profile?.avatar_url, DEFAULT_AVATAR);
  control.replaceChildren(image, element('span', { className: 'account-control__label', text: `欢迎回来, ${label}` }));
  control.classList.add('is-authenticated');
  control.setAttribute('aria-label', `已登录：${label}，打开账户设置`);
}

async function syncAccount() {
  const { data } = await client.auth.getSession();
  const user = data.session?.user || null;
  renderAccountControl(user, await fetchProfile(user));
}

function recordPageView() {
  const visitorId = createUuid(localStorage, 'nobi_visitor_id');
  const sessionId = createUuid(sessionStorage, 'nobi_session_id');
  queueMicrotask(async () => {
    try {
      await client.rpc('record_page_view', {
        p_session_id: sessionId,
        p_visitor_id: visitorId,
        p_page_path: `${location.pathname}${location.search}`.slice(0, 200)
      });
    } catch (_) {
      // Analytics must never block or break page rendering.
    }
  });
}

function getImageTarget(image) {
  const contentId = image.dataset.contentId;
  const kind = image.dataset.imageKind;
  const index = Number(image.dataset.imageIndex || 0);
  const imageKey = getImageKey(image.dataset.imageUrl || image.getAttribute('src'));
  const target = { contentId, kind, index, imageKey };
  return isImageTarget(target) ? target : null;
}

function getImageLikeButton(image) {
  const scope = image.closest('.card, .gallery-item') || image.parentElement;
  return scope?.querySelector('[data-image-like]') || null;
}

function getLikeSummaryKeys(button) {
  try {
    const keys = JSON.parse(button?.dataset.imageLikeSummaryKeys || '[]');
    return Array.isArray(keys) ? keys.filter((key) => typeof key === 'string' && key) : [];
  } catch (_) {
    return [];
  }
}

function applyLikeState(image, count, liked) {
  const normalizedCount = Number(count) || 0;
  image.dataset.likeCount = String(normalizedCount);
  image.dataset.liked = String(Boolean(liked));
  const button = getImageLikeButton(image);
  const countNode = button?.querySelector('[data-image-like-count]');
  if (countNode) countNode.textContent = String(normalizedCount);
  button?.classList.toggle('is-liked', Boolean(liked));
  button?.setAttribute('aria-pressed', String(Boolean(liked)));
  const label = button?.querySelector('[data-image-like-label]');
  if (label) label.textContent = liked ? '已点赞' : '点赞';
}

async function toggleImageLike(image, button) {
  const target = getImageTarget(image);
  if (!features.imageLikes || !target || button.disabled) return;
  button.disabled = true;
  try {
    const { data, error } = await client.rpc('toggle_image_like', {
      p_content_id: target.contentId,
      p_image_kind: target.kind,
      p_image_index: target.index,
      p_image_key: target.imageKey,
      p_anonymous_id: createUuid(localStorage, 'nobi_anon_id')
    });
    if (error) throw error;
    const result = data?.[0];
    const summaryKeys = getLikeSummaryKeys(button);
    const displayedCount = summaryKeys.length
      ? Number(button.querySelector('[data-image-like-count]')?.textContent) || 0
      : result?.like_count || 0;
    applyLikeState(image, displayedCount, result?.liked || false);
    if (summaryKeys.length) {
      lastLikeTargetSignature = '';
      await refreshLikeSummaries();
    }
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nobi-engagement');
      channel.postMessage({ type: 'image-like-changed' });
      channel.close();
    }
  } catch (_) {
    button.dataset.error = '点赞暂时不可用';
    button.setAttribute('aria-label', '点赞暂时不可用，请稍后重试');
  } finally {
    button.disabled = false;
  }
}

async function refreshLikeSummaries() {
  if (!features.imageLikes) return;
  const images = [...document.querySelectorAll('img[data-content-id][data-image-kind]')];
  const targets = images.map(getImageTarget).filter(Boolean);
  const summaryKeys = images.flatMap((image) => getLikeSummaryKeys(getImageLikeButton(image)));
  const imageKeys = [...new Set([...targets.map((target) => target.imageKey), ...summaryKeys])].sort();
  const signature = imageKeys.join(',') + ':' + images.length;
  if (!imageKeys.length || signature === lastLikeTargetSignature) return;
  lastLikeTargetSignature = signature;
  try {
    const { data, error } = await client.rpc('get_image_like_summary', {
      p_image_keys: imageKeys,
      p_anonymous_id: createUuid(localStorage, 'nobi_anon_id')
    });
    if (error) throw error;
    const summaries = mapImageLikeSummaries(data || []);
    images.forEach((image) => {
      const target = getImageTarget(image);
      if (!target) return;
      const row = summaries.get(imageTargetKey(target));
      const aggregateKeys = getLikeSummaryKeys(getImageLikeButton(image));
      const displayedCount = aggregateKeys.length ? sumImageLikeCounts(summaries, aggregateKeys) : row?.count || 0;
      applyLikeState(image, displayedCount, row?.liked || false);
    });
  } catch (_) {
    lastLikeTargetSignature = '';
  }
}

function scheduleLikeSummaryRefresh() {
  clearTimeout(likeRefreshTimer);
  likeRefreshTimer = setTimeout(refreshLikeSummaries, 120);
}

function ensureLightbox() {
  let modal = document.getElementById('image-lightbox');
  if (modal) return modal;
  modal = element('div', { className: 'image-lightbox', attributes: { id: 'image-lightbox', hidden: '' } });
  const panel = element('div', {
    className: 'image-lightbox__panel',
    attributes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'image-lightbox-title', tabindex: '-1' }
  });
  const close = element('button', {
    className: 'image-lightbox__close',
    text: '×',
    attributes: { type: 'button', 'aria-label': '关闭图片预览' }
  });
  const title = element('h2', { className: 'sr-only', text: '图片预览', attributes: { id: 'image-lightbox-title' } });
  const image = element('img', { className: 'image-lightbox__image', attributes: { alt: '' } });
  const like = element('button', {
    className: 'image-like-button',
    text: '♡ 点赞 0',
    attributes: { type: 'button', 'aria-pressed': 'false' }
  });
  const caption = element('p', { className: 'image-lightbox__caption' });
  const actions = element('div', { className: 'image-lightbox__actions' });
  const detailLink = element('a', { className: 'image-detail-link', text: '查看详情', attributes: { hidden: '' } });
  actions.append(like, detailLink);
  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('has-open-modal');
  };
  close.addEventListener('click', closeModal);
  modal.addEventListener('mousedown', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  panel.append(close, title, image, caption, actions);
  modal.append(panel);
  document.body.append(modal);
  return modal;
}

async function openLightbox(sourceImage) {
  const modal = ensureLightbox();
  const preview = modal.querySelector('.image-lightbox__image');
  const caption = modal.querySelector('.image-lightbox__caption');
  const likeButton = modal.querySelector('.image-like-button');
  const detailLink = modal.querySelector('.image-detail-link');
  const source = safeImageUrl(sourceImage.currentSrc || sourceImage.src, 'images/IMG_4893.webp');
  setImageSource(preview, source, 'images/IMG_4893.webp');
  preview.alt = sourceImage.alt || '动漫图片预览';
  caption.textContent = sourceImage.alt || 'NOBI 动漫图片';
  const detailUrl = getDetailUrl(sourceImage);
  detailLink.hidden = !detailUrl;
  if (detailUrl) detailLink.href = detailUrl;
  else detailLink.removeAttribute('href');
  modal.hidden = false;
  document.body.classList.add('has-open-modal');
  modal.querySelector('.image-lightbox__panel').focus();

  const target = getImageTarget(sourceImage);
  likeButton.hidden = !features.imageLikes || !target;
  if (!target || likeButton.hidden) return;
  const updateButton = () => {
    const liked = sourceImage.dataset.liked === 'true';
    const count = Number(sourceImage.dataset.likeCount || 0);
    likeButton.textContent = `${liked ? '♥ 已点赞' : '♡ 点赞'} ${count}`;
    likeButton.classList.toggle('is-liked', liked);
    likeButton.setAttribute('aria-pressed', String(liked));
  };
  updateButton();
  likeButton.onclick = async () => {
    likeButton.disabled = true;
    try {
      const { data, error } = await client.rpc('toggle_image_like', {
        p_content_id: target.contentId,
        p_image_kind: target.kind,
        p_image_index: target.index,
        p_image_key: target.imageKey,
        p_anonymous_id: createUuid(localStorage, 'nobi_anon_id')
      });
      if (error) throw error;
      const result = data?.[0];
      applyLikeState(sourceImage, result?.like_count || 0, result?.liked || false);
      updateButton();
    } catch (_) {
      caption.textContent = '点赞暂时不可用，请稍后重试。';
    } finally {
      likeButton.disabled = false;
    }
  };
}

function initImagePreview() {
  document.addEventListener(
    'click',
    (event) => {
      const likeButton = event.target.closest('[data-image-like]');
      if (likeButton) {
        const scope = likeButton.closest('.card, .gallery-item') || likeButton.parentElement;
        const image = scope?.querySelector('img[data-content-id][data-image-kind]');
        if (!image) return;
        event.preventDefault();
        event.stopPropagation();
        toggleImageLike(image, likeButton);
        return;
      }
      const image = event.target.closest('img[data-preview-image], .gallery-item img');
      if (!image) return;
      const detailUrl = getDetailUrl(image);
      if (detailUrl) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(detailUrl);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openLightbox(image);
    },
    true
  );
  new MutationObserver(scheduleLikeSummaryRefresh).observe(document.body, { childList: true, subtree: true });
  scheduleLikeSummaryRefresh();
}

async function init() {
  initSiteHeader();
  try {
    client = await initializeSupabase();
    const { data: configRows } = await client
      .from('site_config')
      .select('section,url')
      .in('section', ['social_links', 'features_v2']);
    const configs = new Map((configRows || []).map((row) => [row.section, parseJsonConfig(row.url)]));
    features = { ...features, ...(configs.get('features_v2') || {}) };
    renderSocialLinks(configs.get('social_links') || {});
    await syncAccount();
    client.auth.onAuthStateChange(() => {
      lastLikeTargetSignature = '';
      setTimeout(() => {
        syncAccount();
        scheduleLikeSummaryRefresh();
      }, 0);
    });
    if (features.analytics) recordPageView();
    initImagePreview();
  } catch (_) {
    initImagePreview();
  }
}

document.addEventListener('DOMContentLoaded', init);
