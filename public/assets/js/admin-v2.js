import { isValidSocialUrl, parseSocialSettings, serializeSocialSettings } from './src/config/social.js';
import { createCanonicalContentEditor, disableLegacyAdminWrites } from './src/admin/content-editor.js';

let loadedSocialSettings = parseSocialSettings({});
let socialConfigLoaded = false;

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value ?? '—');
}

function renderTrend(rows = []) {
  const chart = document.getElementById('admin-visit-trend');
  if (!chart) return;
  const max = Math.max(1, ...rows.map((row) => Number(row.views) || 0));
  chart.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement('div');
      item.className = 'admin-trend__item';
      const bar = document.createElement('div');
      bar.className = 'admin-trend__bar';
      bar.style.height = `${Math.max(5, ((Number(row.views) || 0) / max) * 58)}px`;
      bar.title = `${row.day}: ${row.views} PV / ${row.visitors} 位访客`;
      const label = document.createElement('span');
      label.textContent = String(row.day || '').slice(5);
      item.append(bar, label);
      return item;
    })
  );
}

async function loadStats(client) {
  const status = document.getElementById('admin-stats-status');
  const { data: configRow } = await client.from('site_config').select('url').eq('section', 'features_v2').maybeSingle();
  if (!configRow) {
    if (status) status.textContent = '应用数据库 migration 后将开始记录访问量与图片点赞。';
    return;
  }
  const { data, error } = await client.rpc('get_admin_dashboard_stats');
  if (error) {
    if (status) status.textContent = '统计加载失败，请稍后重试。';
    return;
  }
  const stats = typeof data === 'string' ? JSON.parse(data) : data;
  setText('stat-total-views', stats.total_views);
  setText('stat-today-views', stats.today_views);
  setText('stat-total-posts', stats.total_posts);
  setText('stat-post-likes', stats.post_likes);
  setText('stat-image-likes', stats.image_likes);
  renderTrend(stats.views_7d || []);
  if (status) status.textContent = '统计数据已更新。';

  const popular = document.getElementById('popular-images-list');
  if (popular) {
    popular.replaceChildren(
      ...(stats.popular_images || []).map((item) => {
        const row = document.createElement('li');
        row.textContent = `${item.title || '未命名内容'} · ${item.image_kind} #${Number(item.image_index) + 1} · ${item.likes} 赞`;
        return row;
      })
    );
  }
}

async function loadSocialConfig(client) {
  const { data, error } = await client.from('site_config').select('url').eq('section', 'social_links').maybeSingle();
  socialConfigLoaded = !error;
  loadedSocialSettings = parseSocialSettings(error ? {} : data?.url);
  loadedSocialSettings.forEach(({ key, url, enabled }) => {
    const input = document.getElementById(`social-${key}`);
    const enabledInput = document.getElementById(`social-${key}-enabled`);
    if (input) input.value = url;
    if (enabledInput) enabledInput.checked = enabled;
  });
  if (error) document.getElementById('social-config-feedback').textContent = '社交链接加载失败，刷新后重试再保存。';
}

function initSocialForm(client) {
  const form = document.getElementById('social-config-form');
  const feedback = document.getElementById('social-config-feedback');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!socialConfigLoaded) {
      feedback.textContent = '社交链接尚未加载，请刷新后重试。';
      return;
    }
    for (const item of loadedSocialSettings) {
      const input = document.getElementById(`social-${item.key}`);
      const enabledInput = document.getElementById(`social-${item.key}-enabled`);
      const value = input.value.trim();
      if (!isValidSocialUrl(value, item.key)) {
        feedback.textContent = `${item.label}链接无效，请输入对应平台的有效网址。`;
        input.focus();
        return;
      }
      item.url = value;
      item.enabled = enabledInput.checked;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    feedback.textContent = '正在保存社交链接…';
    try {
      const { error } = await client.from('site_config').upsert({
        section: 'social_links',
        url: serializeSocialSettings(loadedSocialSettings)
      });
      if (error) throw error;
      feedback.textContent = '社交链接已保存，前台刷新后生效。';
    } catch {
      feedback.textContent = '社交链接保存失败，请稍后重试。';
    } finally {
      submit.disabled = false;
    }
  });
}

function initContentTools(client, supabaseUrl) {
  const search = document.getElementById('admin-content-search');
  const filter = document.getElementById('admin-content-filter');
  const apply = () => {
    const term = search.value.trim().toLowerCase();
    document.querySelectorAll('.img-preview-card[data-category]').forEach((card) => {
      const matchesCategory = !filter.value || card.dataset.category === filter.value;
      const matchesSearch = !term || card.textContent.toLowerCase().includes(term);
      card.hidden = !(matchesCategory && matchesSearch);
    });
  };
  search?.addEventListener('input', apply);
  filter?.addEventListener('change', apply);

  document.getElementById('sections-wrapper')?.addEventListener('click', async (event) => {
    const previewImage = event.target.closest('.img-container img');
    if (previewImage) {
      let dialog = document.getElementById('admin-image-lightbox');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'admin-image-lightbox';
        dialog.className = 'admin-image-lightbox';
        const image = document.createElement('img');
        image.alt = '后台图片预览';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'cancel-edit-btn';
        close.textContent = '关闭预览';
        close.addEventListener('click', () => dialog.close());
        dialog.append(image, close);
        document.body.append(dialog);
      }
      dialog.querySelector('img').src = previewImage.currentSrc || previewImage.src;
      dialog.showModal();
      return;
    }

    const cancel = event.target.closest('.cancel-edit-btn[data-category]');
    if (cancel) {
      await window.refreshLiveDashboard?.(supabaseUrl);
      return;
    }

    const button = event.target.closest('.delete-content-btn');
    if (!button) return;
    const { category, slot } = button.dataset;
    if (
      !confirm(
        `确定删除${category === 'anime' ? '动漫' : '漫画'}第 ${Number(slot) + 1} 个内容吗？此操作会移除前台内容。`
      )
    )
      return;
    button.disabled = true;
    const { error } = await client
      .from('content_management')
      .delete()
      .eq('category', category)
      .eq('slot_index', Number(slot));
    if (error) {
      alert('删除失败，请稍后重试。');
      button.disabled = false;
      return;
    }
    await window.refreshLiveDashboard?.(supabaseUrl);
  });
}

window.addEventListener('nobi:admin-ready', async (event) => {
  const client = window.supabaseClient;
  if (!client) return;
  disableLegacyAdminWrites();
  const wrapper = document.getElementById('sections-wrapper');
  const canonicalEditor = wrapper
    ? createCanonicalContentEditor(client, wrapper, (message, kind) => {
        const status = document.getElementById('upload-status');
        if (status) {
          status.textContent = message;
          status.dataset.kind = kind;
        }
      })
    : null;
  try {
    await canonicalEditor?.load();
  } catch (error) {
    if (wrapper) wrapper.textContent = 'Canonical 内容管理加载失败，请稍后重试。';
  }
  await Promise.all([loadStats(client), loadSocialConfig(client)]);
  initSocialForm(client);
  initContentTools(client, event.detail?.supabaseUrl);
  document.getElementById('refresh-admin-stats')?.addEventListener('click', () => loadStats(client));
  if ('BroadcastChannel' in window) {
    const engagementChannel = new BroadcastChannel('nobi-engagement');
    engagementChannel.addEventListener('message', () => loadStats(client));
  }
  window.setInterval(() => {
    if (!document.hidden) loadStats(client);
  }, 15000);
});
