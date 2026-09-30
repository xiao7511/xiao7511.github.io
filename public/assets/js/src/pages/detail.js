import { initializeSupabase } from '../api/supabase.js';
import { element, normalizeImageUrl, setContentState, setImageSource, setLoadingState } from '../components/dom.js';
import { updateCopyrightYear } from '../components/header.js';
import { selectCanonicalContent, homeContentYear, normalizeContentTags } from '../home/content.js';
import { getImageKey } from '../images/likes.js';

export function resolveDetailRecord(rows, category, slot) {
  if (!['anime', 'manga'].includes(category) || !/^\d{1,3}$/.test(String(slot ?? ''))) return null;
  return selectCanonicalContent(rows, category).find((item) => item.slot_index === Number(slot)) || null;
}

export function normalizeDetailGallery(value, coverUrl, baseUrl = window.location.href) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const coverKey = getImageKey(coverUrl);
  if (coverKey) seen.add(`storage:${coverKey}`);
  return value.flatMap((raw, index) => {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    let url;
    try {
      url = new URL(raw.trim(), baseUrl);
    } catch {
      return [];
    }
    const safeUrl = normalizeImageUrl(url.href, '');
    if (!safeUrl || !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)) return [];
    const imageKey = getImageKey(safeUrl);
    const identity = imageKey ? `storage:${imageKey}` : `url:${safeUrl}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ url: safeUrl, index }];
  });
}

export async function initDetailPage() {
  updateCopyrightYear();
  document.getElementById('detail-back')?.addEventListener('click', (event) => {
    if (history.length <= 1) return;
    event.preventDefault();
    history.back();
  });

  const route = new URLSearchParams(location.search);
  const category = route.get('category');
  const slot = route.get('slot');
  const status = document.getElementById('status-tips');
  const stream = document.getElementById('gallery-stream');
  if (!status || !stream) return;
  setLoadingState(stream, { count: 2, variant: 'manga', label: '正在加载作品详情' });

  if (!['anime', 'manga'].includes(category) || !/^\d{1,3}$/.test(slot || '')) {
    status.hidden = true;
    setContentState(stream, { message: '详情链接无效，请返回列表重新选择。', kind: 'error' });
    return;
  }

  try {
    const client = await initializeSupabase();
    const { data: rows, error } = await client.from('content_management').select('*').eq('category', category);
    if (error) throw error;
    const data = resolveDetailRecord(rows, category, slot);
    if (!data) {
      status.hidden = true;
      setContentState(stream, { message: '该作品暂时没有详情内容。' });
      return;
    }

    status.hidden = true;
    const metaPanel = document.getElementById('meta-panel');
    metaPanel.hidden = false;
    document.getElementById('detail-title').textContent = data.title || '未命名主题';
    document.getElementById('detail-sub').textContent = data.subtitle || '';
    document.getElementById('detail-year').textContent = homeContentYear(data) ? `年份 ${homeContentYear(data)}` : '';
    document
      .getElementById('detail-tags')
      .replaceChildren(
        ...normalizeContentTags(data, Number.MAX_SAFE_INTEGER).map((tag) =>
          element('span', { className: 'tag-item', text: tag })
        )
      );

    const cover = document.getElementById('detail-cover');
    document.getElementById('detail-cover-section').hidden = false;
    const coverImage = element('img', {
      attributes: {
        loading: 'eager',
        decoding: 'async',
        alt: `${data.title} 封面`,
        'data-content-id': data.id,
        'data-image-kind': 'cover',
        'data-image-index': '0',
        'data-image-url': typeof data.cover_url === 'string' ? data.cover_url : '',
        'data-preview-image': ''
      }
    });
    setImageSource(coverImage, data.cover_url, 'images/IMG_4893.webp');
    cover.replaceChildren(
      element('div', { className: 'gallery-item detail-cover-item' }, [
        coverImage,
        element(
          'button',
          {
            className: 'image-like-button image-like-button--overlay',
            attributes: {
              type: 'button',
              'data-image-like': '',
              'aria-label': '点赞封面',
              'aria-pressed': 'false',
              ...(getImageKey(data.cover_url) ? {} : { hidden: '' })
            }
          },
          [
            element('span', { text: '♡', attributes: { 'aria-hidden': 'true' } }),
            element('span', { text: '点赞', attributes: { 'data-image-like-label': '' } }),
            element('strong', { text: '0', attributes: { 'data-image-like-count': '' } })
          ]
        )
      ])
    );

    stream.setAttribute('aria-busy', 'false');
    stream.replaceChildren();
    normalizeDetailGallery(data.detail_urls, data.cover_url).forEach(({ url, index }) => {
      const image = element('img', {
        attributes: {
          loading: 'lazy',
          decoding: 'async',
          alt: `${data.title || '详情图片'} ${index + 1}`,
          'data-content-id': data.id,
          'data-image-kind': 'detail',
          'data-image-index': String(index),
          'data-image-url': url,
          'data-preview-image': ''
        }
      });
      if (setImageSource(image, url, 'images/IMG_4893.webp')) {
        stream.append(
          element('div', { className: 'gallery-item' }, [
            image,
            element(
              'button',
              {
                className: 'image-like-button image-like-button--overlay',
                attributes: {
                  type: 'button',
                  'data-image-like': '',
                  'aria-label': `Like image ${index + 1}`,
                  'aria-pressed': 'false',
                  ...(getImageKey(url) ? {} : { hidden: '' })
                }
              },
              [
                element('span', { text: '♡', attributes: { 'aria-hidden': 'true' } }),
                element('span', { text: '点赞', attributes: { 'data-image-like-label': '' } }),
                element('strong', { text: '0', attributes: { 'data-image-like-count': '' } })
              ]
            )
          ])
        );
      }
    });

    if (!stream.children.length) setContentState(stream, { message: '该作品已发布封面，详情图片仍在准备中。' });
  } catch (error) {
    console.error('加载作品详情失败:', error);
    status.hidden = true;
    setContentState(stream, {
      message: '详情加载失败，请检查网络后重试。',
      kind: 'error',
      onRetry: initDetailPage
    });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initDetailPage);
