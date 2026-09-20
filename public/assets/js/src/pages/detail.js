import { fetchApiJson } from '../api/content.js';
import { element, setContentState, setImageSource, setLoadingState } from '../components/dom.js';
import { updateCopyrightYear } from '../components/header.js';

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

  if (!category || !/^\d{1,3}$/.test(slot || '')) {
    status.hidden = true;
    setContentState(stream, { message: '详情链接无效，请返回列表重新选择。', kind: 'error' });
    return;
  }

  try {
    const data = await fetchApiJson('api/detail', { category, slot });
    if (!data || typeof data !== 'object') {
      status.hidden = true;
      setContentState(stream, { message: '该作品暂时没有详情内容。' });
      return;
    }

    status.hidden = true;
    const metaPanel = document.getElementById('meta-panel');
    metaPanel.hidden = false;
    document.getElementById('detail-title').textContent = data.title || '未命名主题';
    document.getElementById('detail-sub').textContent = data.subtitle || '';
    document
      .getElementById('detail-tags')
      .replaceChildren(
        ...(Array.isArray(data.theme_tags) ? data.theme_tags : []).map((tag) =>
          element('span', { className: 'tag-item', text: tag })
        )
      );

    stream.setAttribute('aria-busy', 'false');
    stream.replaceChildren();
    (Array.isArray(data.detail_urls) ? data.detail_urls : []).forEach((url, index) => {
      const image = element('img', {
        attributes: { loading: 'lazy', decoding: 'async', alt: `${data.title || '详情图片'} ${index + 1}` }
      });
      if (setImageSource(image, url)) stream.append(element('div', { className: 'gallery-item' }, [image]));
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

document.addEventListener('DOMContentLoaded', initDetailPage);
