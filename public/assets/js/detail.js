document.getElementById('detail-back')?.addEventListener('click', (event) => { event.preventDefault(); history.back(); });
async function loadDetailWorkflow() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const slot = params.get('slot');
  const status = document.getElementById('status-tips');
  if (!category || !/^\d{1,3}$/.test(slot || '')) {
    status.textContent = '❌ 参数路由解析失败。';
    return;
  }
  try {
    const query = new URLSearchParams({ category, slot });
    const response = await fetch(`${window.SiteConfig.apiOrigin}/api/detail?${query.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('网关传输失败');
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      status.textContent = '📷 该槽位暂未发布任何详情画集/正文。';
      return;
    }
    status.hidden = true;
    document.getElementById('meta-panel').style.display = 'block';
    document.getElementById('detail-title').textContent = data.title || '未命名主题';
    document.getElementById('detail-sub').textContent = data.subtitle || '';
    const tags = document.getElementById('detail-tags');
    tags.replaceChildren(...(Array.isArray(data.theme_tags) ? data.theme_tags : []).map((tag) => window.SecurityUtils.element('span', { className: 'tag-item', text: tag })));
    const stream = document.getElementById('gallery-stream');
    stream.replaceChildren();
    const urls = Array.isArray(data.detail_urls) ? data.detail_urls : [];
    urls.forEach((url) => {
      const img = window.SecurityUtils.element('img', { attributes: { loading: 'lazy', decoding: 'async', alt: data.title || '详情图片' } });
      if (window.SecurityUtils.setImageSource(img, url, 'images/IMG_4893.webp')) {
        stream.append(window.SecurityUtils.element('div', { className: 'gallery-item' }, [img]));
      }
    });
    if (!stream.children.length) window.SecurityUtils.setMessage(stream, '💡 后台仅上传了封面，尚未上传详情页多图内容。', 'text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem;');
  } catch (error) {
    console.error(error);
    status.textContent = '❌ 调取加密云仓数据流失败，请稍后重试。';
  }
}
document.addEventListener('DOMContentLoaded', loadDetailWorkflow);
