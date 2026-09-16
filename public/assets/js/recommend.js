document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('dynamic-recommend-container');
  if (!container) return;
  const { element, setImageSource, setMessage } = window.SecurityUtils;
  try {
    const response = await fetch(`${window.SiteConfig.apiOrigin}/api/recommend`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('网关响应异常');
    const data = await response.json();
    container.replaceChildren();
    if (!Array.isArray(data) || data.length === 0) {
      setMessage(container, '💡 后台暂未发布任何动漫推荐内容。', 'text-align:center;color:#a4b0be;grid-column:1/-1;');
      return;
    }
    data.forEach((item) => {
      const image = element('img', { attributes: { alt: item.title || '作品封面', loading: 'lazy', decoding: 'async' }, style: 'width:100%;height:100%;object-fit:cover;display:block;' });
      setImageSource(image, item.cover_url, 'images/IMG_4893.png');
      const imageBox = element('div', { style: 'width:100%;height:280px;overflow:hidden;' }, [image]);
      const body = element('div', { className: 'card__body', style: 'padding:16px;flex-grow:1;' }, [
        element('h2', { className: 'card__title', text: item.title || '未命名作品' }),
        element('p', { className: 'card__tag', text: (Array.isArray(item.theme_tags) ? item.theme_tags.join(' / ') : '') || item.subtitle || '精品推荐' })
      ]);
      const card = element('article', { className: 'card', style: 'cursor:pointer;display:flex;flex-direction:column;height:100%;overflow:hidden;' }, [imageBox, body]);
      card.addEventListener('click', () => {
        const params = new URLSearchParams({ category: String(item.category || ''), slot: String(item.slot_index ?? '') });
        window.location.assign(`detail.html?${params.toString()}`);
      });
      container.append(card);
    });
  } catch (error) {
    console.error('加载动漫推荐失败:', error);
    setMessage(container, '❌ 安全隔离通道数据请求失败，请检查 Worker 配置。', 'text-align:center;color:#ff4757;grid-column:1/-1;');
  }
});
