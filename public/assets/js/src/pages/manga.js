import { fetchApiJson } from '../api/content.js';
import { element, setContentState, setImageSource, setLoadingState } from '../components/dom.js';
import { initSiteHeader, updateCopyrightYear } from '../components/header.js';

export async function initMangaPage() {
  initSiteHeader();
  updateCopyrightYear();
  const container = document.getElementById('dynamic-manga-container');
  if (!container) return;
  setLoadingState(container, { count: 3, variant: 'manga', label: '正在加载漫画连载' });

  try {
    const data = await fetchApiJson('api/manga');
    container.setAttribute('aria-busy', 'false');
    container.replaceChildren();
    if (!Array.isArray(data) || !data.length) {
      setContentState(container, { message: '暂时没有漫画连载，稍后再来看看吧。' });
      return;
    }

    data.forEach((item) => {
      const params = new URLSearchParams({
        category: String(item.category || ''),
        slot: String(item.slot_index ?? '')
      });
      const href = `detail.html?${params}`;
      const image = element('img', {
        className: 'manga-cover',
        attributes: { alt: item.title ? `${item.title}封面` : '漫画封面', loading: 'lazy', decoding: 'async' }
      });
      setImageSource(image, item.cover_url, 'images/IMG_4893.webp');
      container.append(
        element(
          'a',
          { className: 'manga-item', attributes: { href, 'aria-label': `阅读《${item.title || '未命名连载'}》` } },
          [
            element('div', { className: 'manga-cover-box' }, [image]),
            element('div', { className: 'manga-detail' }, [
              element('div', {}, [
                element('h2', { className: 'manga-title', text: item.title || '未命名连载' }),
                element('p', { className: 'manga-update', text: item.subtitle || '连载中' })
              ]),
              element('span', { className: 'read-btn', text: '开始阅读' })
            ])
          ]
        )
      );
    });
  } catch (error) {
    console.error('加载漫画连载失败:', error);
    setContentState(container, {
      message: '漫画连载加载失败，请检查网络后重试。',
      kind: 'error',
      onRetry: initMangaPage
    });
  }
}

document.addEventListener('DOMContentLoaded', initMangaPage);
