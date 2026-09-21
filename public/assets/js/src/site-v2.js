import { initializeSupabase } from './api/supabase.js';
import { element, safeImageUrl, setImageSource } from './components/dom.js';
import { initSiteHeader } from './components/header.js';
import { imageTargetKey, isImageTarget, mapImageLikeSummaries } from './images/likes.js';

const DEFAULT_AVATAR = 'images/nobi-avatar.svg';
const SOCIAL_LABELS = {
  xiaohongshu: '小红书',
  weibo: '微博',
  twitter: 'X / Twitter',
  instagram: 'Instagram'
};
const SOCIAL_ICONS = {
  xiaohongshu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14v9H5zM8 5v14M16 5v14M5 12h14"/></svg>',
  weibo:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12.8c0 3.4-3.7 6.2-8.3 6.2S3 16.9 3 14.1c0-2.1 2-4.4 5.2-5.3 2.1-.6 4-.4 5.2.3.7.4.8.1 1-.6.2-.9.5-2.5 1.6-2.1 1.4.5.2 2.5.8 2.7.5.2 2.2-.3 2.6.7.4.9-.8 1.5-1.4 1.6-.1 0-.1 0-.2.1.1.4.2.8.2 1.2zM8.2 14.1c-.3 1.2.8 2.4 2.5 2.7 1.8.3 3.5-.5 3.8-1.8.3-1.3-.9-2.5-2.6-2.8-1.7-.3-3.4.6-3.7 1.9z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>'
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
  document.querySelector('.social-dock')?.remove();
  const links = Object.entries(SOCIAL_LABELS)
    .map(([key, label]) => ({ key, label, href: safeExternalUrl(config[key]) }))
    .filter((item) => item.href);
  if (!links.length) return;

  const dock = element('aside', { className: 'social-dock', attributes: { 'aria-label': '关注 NOBI 动漫' } });
  dock.append(element('span', { className: 'social-dock__label', text: '关注' }));
  links.forEach(({ key, label, href }) => {
    const anchor = element('a', {
      className: 'social-dock__link',
      attributes: { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label, title: label }
    });
    anchor.innerHTML = SOCIAL_ICONS[key];
    dock.append(anchor);
  });
  document.body.append(dock);
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
  const target = { contentId, kind, index };
  return isImageTarget(target) ? target : null;
}

function applyLikeState(image, count, liked) {
  image.dataset.likeCount = String(Number(count) || 0);
  image.dataset.liked = String(Boolean(liked));
}

async function refreshLikeSummaries() {
  if (!features.imageLikes) return;
  const images = [...document.querySelectorAll('img[data-content-id][data-image-kind]')];
  const targets = images.map(getImageTarget).filter(Boolean);
  const ids = [...new Set(targets.map((target) => target.contentId))].sort();
  const signature = ids.join(',') + ':' + images.length;
  if (!ids.length || signature === lastLikeTargetSignature) return;
  lastLikeTargetSignature = signature;
  try {
    const { data, error } = await client.rpc('get_image_like_summary', {
      p_content_ids: ids,
      p_anonymous_id: createUuid(localStorage, 'nobi_anon_id')
    });
    if (error) throw error;
    const summaries = mapImageLikeSummaries(data || []);
    images.forEach((image) => {
      const target = getImageTarget(image);
      if (!target) return;
      const row = summaries.get(imageTargetKey(target));
      applyLikeState(image, row?.count || 0, row?.liked || false);
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
  panel.append(close, title, image, caption, like);
  modal.append(panel);
  document.body.append(modal);
  return modal;
}

async function openLightbox(sourceImage) {
  const modal = ensureLightbox();
  const preview = modal.querySelector('.image-lightbox__image');
  const caption = modal.querySelector('.image-lightbox__caption');
  const likeButton = modal.querySelector('.image-like-button');
  const source = safeImageUrl(sourceImage.currentSrc || sourceImage.src, 'images/IMG_4893.webp');
  setImageSource(preview, source, 'images/IMG_4893.webp');
  preview.alt = sourceImage.alt || '动漫图片预览';
  caption.textContent = sourceImage.alt || 'NOBI 动漫图片';
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
      const image = event.target.closest('img[data-preview-image], .gallery-item img');
      if (!image) return;
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
