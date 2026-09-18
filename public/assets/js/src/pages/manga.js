import { fetchApiJson } from '../api/content.js';
import { element, setImageSource, setMessage } from '../components/dom.js';

export async function initMangaPage() {
  const container = document.getElementById('dynamic-manga-container');
  if (!container) return;
  try {
    const data = await fetchApiJson('api/manga');
    container.replaceChildren();
    if (!Array.isArray(data) || !data.length)
      return setMessage(
        container,
        '💡 后台暂未上架任何漫画连载内容。',
        'text-align:center;color:#a4b0be;padding:20px;'
      );
    data.forEach((item) => {
      const open = () =>
        location.assign(
          `detail.html?${new URLSearchParams({ category: String(item.category || ''), slot: String(item.slot_index ?? '') })}`
        );
      const image = element('img', {
        className: 'manga-cover',
        attributes: { alt: item.title || '漫画封面', loading: 'lazy', decoding: 'async' }
      });
      setImageSource(image, item.cover_url, 'images/IMG_4893.png');
      const cover = element('div', { className: 'manga-cover-box', style: 'cursor:pointer;' }, [image]);
      cover.addEventListener('click', open);
      const title = element('div', {
        className: 'manga-title',
        text: item.title || '未命名连载',
        style: 'cursor:pointer;'
      });
      title.addEventListener('click', open);
      const button = element('button', { className: 'read-btn', text: '开始阅读' });
      button.addEventListener('click', open);
      container.append(
        element('div', { className: 'manga-item' }, [
          cover,
          element('div', { className: 'manga-detail' }, [
            element('div', {}, [title, element('div', { className: 'manga-update', text: item.subtitle || '连载中' })]),
            button
          ])
        ])
      );
    });
  } catch (error) {
    console.error('加载漫画连载失败:', error);
    setMessage(container, '❌ 数据流同步失败，请检查边缘网关状态。', 'text-align:center;color:#ff4757;padding:20px;');
  }
}

document.addEventListener('DOMContentLoaded', initMangaPage);
