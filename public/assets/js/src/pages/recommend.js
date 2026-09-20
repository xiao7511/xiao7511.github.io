import { fetchApiJson } from '../api/content.js';
import { element, setContentState, setImageSource, setLoadingState } from '../components/dom.js';
import { initSiteHeader, updateCopyrightYear } from '../components/header.js';

export async function initRecommendPage() {
  initSiteHeader();
  updateCopyrightYear();
  const container = document.getElementById('dynamic-recommend-container');
  if (!container) return;
  setLoadingState(container, { count: 4, variant: 'card', label: '正在加载动漫推荐' });

  try {
    const data = await fetchApiJson('api/recommend');
    container.setAttribute('aria-busy', 'false');
    container.replaceChildren();
    if (!Array.isArray(data) || !data.length) {
      setContentState(container, { message: '暂时没有动漫推荐，稍后再来看看吧。' });
      return;
    }

    data.forEach((item) => {
      const params = new URLSearchParams({
        category: String(item.category || ''),
        slot: String(item.slot_index ?? '')
      });
      const image = element('img', {
        attributes: { alt: item.title ? `${item.title}封面` : '作品封面', loading: 'lazy', decoding: 'async' }
      });
      setImageSource(image, item.cover_url, 'images/IMG_4893.webp');
      container.append(
        element(
          'a',
          {
            className: 'card',
            attributes: { href: `detail.html?${params}`, 'aria-label': `查看《${item.title || '未命名作品'}》详情` }
          },
          [
            image,
            element('div', { className: 'card__body' }, [
              element('h2', { className: 'card__title', text: item.title || '未命名作品' }),
              element('p', {
                className: 'card__tag',
                text: (Array.isArray(item.theme_tags) ? item.theme_tags.join(' / ') : '') || item.subtitle || '精品推荐'
              })
            ])
          ]
        )
      );
    });
  } catch (error) {
    console.error('加载动漫推荐失败:', error);
    setContentState(container, {
      message: '动漫推荐加载失败，请检查网络后重试。',
      kind: 'error',
      onRetry: initRecommendPage
    });
  }
}

document.addEventListener('DOMContentLoaded', initRecommendPage);
