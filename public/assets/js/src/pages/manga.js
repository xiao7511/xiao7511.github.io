import { fetchApiJson } from '../api/content.js';
import { element, setContentState, setImageSource, setLoadingState } from '../components/dom.js';
import { createCoverLikeButton } from '../components/content-like.js';
import { libraryItemModel, selectLibraryItems } from '../content/library.js';
import { initSiteHeader, updateCopyrightYear } from '../components/header.js';

export async function initMangaPage() {
  initSiteHeader();
  updateCopyrightYear();
  const container = document.getElementById('dynamic-manga-container');
  if (!container) return;
  setLoadingState(container, { count: 3, variant: 'manga', label: '正在加载漫画连载' });

  try {
    const data = selectLibraryItems(await fetchApiJson('api/manga'), 'manga');
    container.setAttribute('aria-busy', 'false');
    container.replaceChildren();
    if (!Array.isArray(data) || !data.length) {
      setContentState(container, { message: '暂时没有漫画连载，稍后再来看看吧。' });
      return;
    }

    data.forEach((item) => {
      const metadata = libraryItemModel(item);
      const href = metadata.detailUrl;
      const image = element('img', {
        className: 'manga-cover',
        attributes: {
          alt: item.title ? `${item.title}封面` : '漫画封面',
          loading: 'lazy',
          decoding: 'async',
          'data-content-id': item.id,
          'data-image-kind': 'cover',
          'data-image-index': '0',
          'data-image-url': item.cover_url,
          'data-preview-image': '',
          'data-detail-url': href
        }
      });
      setImageSource(image, item.cover_url, 'images/IMG_4893.webp');
      container.append(
        element('article', { className: 'manga-item' }, [
          element('a', { className: 'manga-cover-box', attributes: { href, 'aria-label': `阅读《${item.title}》` } }, [
            image
          ]),
          element('div', { className: 'manga-detail' }, [
            element('div', {}, [
              element('h2', { className: 'manga-title' }, [element('a', { text: item.title, attributes: { href } })]),
              element('p', {
                className: 'manga-update',
                text: [metadata.year, metadata.tags.join(' / '), item.subtitle].filter(Boolean).join(' · ') || '连载中'
              })
            ]),
            element('div', { className: 'manga-actions' }, [
              element('a', { className: 'read-btn', text: '开始阅读', attributes: { href } }),
              createCoverLikeButton(item)
            ])
          ])
        ])
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
