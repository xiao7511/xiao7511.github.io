import { fetchApiJson } from '../api/content.js';
import { element, setImageSource, setMessage } from '../components/dom.js';

export async function initDetailPage() {
  document.getElementById('detail-back')?.addEventListener('click', (event) => {
    event.preventDefault();
    history.back();
  });
  const route = new URLSearchParams(location.search);
  const category = route.get('category');
  const slot = route.get('slot');
  const status = document.getElementById('status-tips');
  if (!category || !/^\d{1,3}$/.test(slot || '')) {
    status.textContent = '❌ 参数路由解析失败。';
    return;
  }
  try {
    const data = await fetchApiJson('api/detail', { category, slot });
    if (!data || typeof data !== 'object') {
      status.textContent = '📷 该槽位暂未发布任何详情画集/正文。';
      return;
    }
    status.hidden = true;
    document.getElementById('meta-panel').style.display = 'block';
    document.getElementById('detail-title').textContent = data.title || '未命名主题';
    document.getElementById('detail-sub').textContent = data.subtitle || '';
    document
      .getElementById('detail-tags')
      .replaceChildren(
        ...(Array.isArray(data.theme_tags) ? data.theme_tags : []).map((tag) =>
          element('span', { className: 'tag-item', text: tag })
        )
      );
    const stream = document.getElementById('gallery-stream');
    stream.replaceChildren();
    (Array.isArray(data.detail_urls) ? data.detail_urls : []).forEach((url) => {
      const image = element('img', {
        attributes: { loading: 'lazy', decoding: 'async', alt: data.title || '详情图片' }
      });
      if (setImageSource(image, url)) stream.append(element('div', { className: 'gallery-item' }, [image]));
    });
    if (!stream.children.length)
      setMessage(
        stream,
        '💡 后台仅上传了封面，尚未上传详情页多图内容。',
        'text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem;'
      );
  } catch (error) {
    console.error(error);
    status.textContent = '❌ 调取加密云仓数据流失败，请稍后重试。';
  }
}

document.addEventListener('DOMContentLoaded', initDetailPage);
