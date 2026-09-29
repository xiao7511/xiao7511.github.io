import { element, setImageSource } from '../components/dom.js';
import {
  saveContentCover,
  saveContentGallery,
  saveHomeContentOrder,
  updateContentFields,
  validateContentImage
} from './content-management.js';

const categories = [
  ['banner', 'Banner'],
  ['anime', '本季热门 Anime'],
  ['manga', '新番推荐 Manga']
];

function field(labelText, input) {
  return element('label', {}, [element('span', { text: labelText }), input]);
}

function button(text, handler, className = '') {
  const node = element('button', { className, text, attributes: { type: 'button' } });
  node.addEventListener('click', handler);
  return node;
}

function fileInput(onChange) {
  const input = element('input', {
    attributes: { type: 'file', accept: 'image/jpeg,image/png,image/webp' }
  });
  input.addEventListener('change', onChange);
  return input;
}

function imagePreview(source, alt) {
  const image = element('img', { attributes: { alt, loading: 'lazy', decoding: 'async' } });
  setImageSource(image, source, 'images/nobi-anime-placeholder.svg');
  return element('div', { className: 'img-container' }, [image]);
}

function tagsFrom(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function message(error) {
  if (error?.message === 'INVALID_CONTENT_IMAGE_TYPE') return '仅支持 JPEG、PNG、WebP 图片。';
  if (error?.message === 'INVALID_CONTENT_IMAGE_SIZE') return '图片必须小于或等于 10MB。';
  return error?.message || '保存失败，请稍后重试。';
}

export function disableLegacyAdminWrites() {
  const panel = document.getElementById('banner-management');
  const input = document.getElementById('file-input');
  const upload = document.getElementById('upload-btn');
  if (input) input.disabled = true;
  if (upload) upload.disabled = true;
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) dropZone.hidden = true;
  if (upload) upload.hidden = true;
  const heading = panel?.querySelector('h2');
  if (heading) heading.textContent = 'Canonical 内容管理已启用';
  const status = document.getElementById('upload-status');
  if (status) status.textContent = '旧版批量部署入口已停用，请使用下方逐项内容管理。';
}

export function createCanonicalContentEditor(client, wrapper, onStatus = () => {}) {
  let records = [];
  let busy = false;
  const drafts = new Map();
  const objectUrls = new Set();

  const revoke = (url) => {
    if (!url || !objectUrls.has(url)) return;
    URL.revokeObjectURL(url);
    objectUrls.delete(url);
  };

  const preview = (file) => {
    const url = URL.createObjectURL(file);
    objectUrls.add(url);
    return url;
  };

  const draftFor = (item) => {
    if (!drafts.has(item.id)) {
      drafts.set(item.id, {
        coverFile: null,
        coverPreview: '',
        gallery: (item.detail_urls || []).map((url) => ({ key: crypto.randomUUID(), existingUrl: url }))
      });
    }
    return drafts.get(item.id);
  };

  const setBusy = (value) => {
    busy = value;
    wrapper.querySelectorAll('button,input,select').forEach((control) => {
      control.disabled = value;
    });
  };

  async function run(label, action) {
    if (busy) return;
    setBusy(true);
    onStatus(`${label}处理中…`, 'info');
    try {
      await action();
      onStatus(`${label}已保存。`, 'success');
      render();
    } catch (error) {
      onStatus(`${label}失败：${message(error)}`, 'error');
      render();
    } finally {
      busy = false;
    }
  }

  function selectImage(event, assign) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      validateContentImage(file);
      assign(file);
      render();
    } catch (error) {
      onStatus(message(error), 'error');
    }
  }

  function renderMetadata(item, card) {
    const title = element('input', { attributes: { value: item.title || '', maxlength: '120' } });
    const subtitle = element('input', { attributes: { value: item.subtitle || '', maxlength: '180' } });
    const tags = element('input', { attributes: { value: (item.theme_tags || []).join(',') } });
    const fields = element('div', { className: 'form-stack' }, [
      field('标题', title),
      field('副标题', subtitle),
      field('标签（逗号分隔）', tags)
    ]);
    const save = button('保存文字信息', () =>
      run(`${item.title || '内容'}文字信息`, async () => {
        const updated = await updateContentFields(client, item, {
          title: title.value.trim(),
          subtitle: subtitle.value.trim(),
          theme_tags: tagsFrom(tags.value)
        });
        Object.assign(item, updated);
      })
    );
    card.append(fields, save);
  }

  function renderCover(item, card) {
    const draft = draftFor(item);
    card.append(
      element('h3', { text: item.category === 'banner' ? '首页 Banner 图片' : '封面' }),
      imagePreview(draft.coverPreview || item.cover_url, `${item.title || '内容'}封面`)
    );
    const picker = fileInput((event) =>
      selectImage(event, (file) => {
        revoke(draft.coverPreview);
        draft.coverFile = file;
        draft.coverPreview = preview(file);
      })
    );
    card.append(field(draft.coverFile ? `待上传：${draft.coverFile.name}` : '选择 / 更换图片', picker));
    const save = button('保存图片', () =>
      run(`${item.title || '内容'}图片`, async () => {
        if (!draft.coverFile) throw new Error('请先选择图片。');
        const url = await saveContentCover(client, item, draft.coverFile, (stage) =>
          onStatus(stage === 'uploading' ? '图片上传中…' : '图片保存中…', 'info')
        );
        item.cover_url = url;
        revoke(draft.coverPreview);
        draft.coverPreview = '';
        draft.coverFile = null;
      })
    );
    save.disabled = !draft.coverFile;
    card.append(save);
  }

  function renderBannerFields(item, card) {
    const linked = element('select');
    linked.append(element('option', { text: '未关联主题', attributes: { value: '' } }));
    for (const category of ['anime', 'manga']) {
      const group = element('optgroup', { attributes: { label: category === 'anime' ? 'Anime' : 'Manga' } });
      records
        .filter((entry) => entry.category === category)
        .sort((a, b) => a.slot_index - b.slot_index)
        .forEach((entry) => {
          const option = element('option', { text: entry.title || '未命名内容', attributes: { value: entry.id } });
          option.selected = entry.id === item.linked_content_id;
          group.append(option);
        });
      linked.append(group);
    }
    const association = button('保存关联主题', () =>
      run(`${item.title || 'Banner'}关联主题`, async () => {
        const updated = await updateContentFields(client, item, { linked_content_id: linked.value || null });
        item.linked_content_id = updated.linked_content_id;
      })
    );

    const slot = element('input', {
      attributes: { type: 'number', min: '0', max: '20', value: String(item.slot_index) }
    });
    const active = element('input', { attributes: { type: 'checkbox' } });
    active.checked = item.is_active !== false;
    const state = button('保存排序与状态', () =>
      run(`${item.title || 'Banner'}排序与状态`, async () => {
        const updated = await updateContentFields(client, item, {
          slot_index: Number(slot.value),
          is_active: active.checked
        });
        Object.assign(item, updated);
        records.sort((a, b) => a.category.localeCompare(b.category) || a.slot_index - b.slot_index);
      })
    );
    card.append(
      field('关联主题', linked),
      association,
      element('div', { className: 'admin-canonical-state' }, [field('排序', slot), field('启用', active), state])
    );
  }

  function renderGallery(item, card) {
    const draft = draftFor(item);
    const section = element('section', { className: 'admin-canonical-gallery' }, [
      element('h3', { text: `详情图集（${draft.gallery.length}）` })
    ]);
    const grid = element('div', { className: 'admin-canonical-gallery__grid' });
    draft.gallery.forEach((entry, index) => {
      const replace = fileInput((event) =>
        selectImage(event, (file) => {
          revoke(entry.previewUrl);
          entry.file = file;
          entry.previewUrl = preview(file);
        })
      );
      const remove = button('删除', () => {
        revoke(entry.previewUrl);
        draft.gallery.splice(index, 1);
        render();
      });
      const up = button('↑', () => {
        [draft.gallery[index - 1], draft.gallery[index]] = [draft.gallery[index], draft.gallery[index - 1]];
        render();
      });
      up.disabled = index === 0;
      const down = button('↓', () => {
        [draft.gallery[index + 1], draft.gallery[index]] = [draft.gallery[index], draft.gallery[index + 1]];
        render();
      });
      down.disabled = index === draft.gallery.length - 1;
      grid.append(
        element('article', {}, [
          imagePreview(entry.previewUrl || entry.existingUrl, `${item.title || '内容'}详情图片 ${index + 1}`),
          field(entry.file ? `待替换：${entry.file.name}` : '替换图片', replace),
          element('div', { className: 'admin-canonical-gallery__actions' }, [remove, up, down])
        ])
      );
    });
    if (draft.gallery.length) section.append(grid);
    else section.append(element('p', { className: 'admin-feedback', text: '当前没有详情图片。' }));

    const add = fileInput((event) =>
      selectImage(event, (file) => {
        draft.gallery.push({ key: crypto.randomUUID(), file, previewUrl: preview(file) });
      })
    );
    section.append(field('＋ 添加详情图片', add));
    section.append(
      button('保存详情图集', () =>
        run(`${item.title || '内容'}详情图集`, async () => {
          const urls = await saveContentGallery(client, item, draft.gallery, (stage, current, total) =>
            onStatus(stage === 'uploading' ? `图集上传中 ${current}/${total}…` : '图集保存中…', 'info')
          );
          draft.gallery.forEach((entry) => revoke(entry.previewUrl));
          item.detail_urls = urls;
          draft.gallery = urls.map((url) => ({ key: crypto.randomUUID(), existingUrl: url }));
        })
      )
    );
    card.append(section);
  }

  function moveContent(category, index, direction) {
    const rows = records.filter((item) => item.category === category).sort((a, b) => a.slot_index - b.slot_index);
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    const allOther = records.filter((item) => item.category !== category);
    [rows[index], rows[next]] = [rows[next], rows[index]];
    rows.forEach((item, position) => (item.slot_index = position));
    records = [...allOther, ...rows];
    render();
  }

  function renderCategory(category, label) {
    const rows = records.filter((item) => item.category === category).sort((a, b) => a.slot_index - b.slot_index);
    const section = element('section', { className: 'dashboard-section admin-canonical-section' }, [
      element('h2', { text: label })
    ]);
    const grid = element('div', { className: 'image-flow-grid' });
    rows.forEach((item, index) => {
      const card = element('article', {
        className: 'img-preview-card admin-canonical-card',
        attributes: { 'data-category': category, 'data-slot': String(item.slot_index) }
      });
      renderCover(item, card);
      renderMetadata(item, card);
      if (category === 'banner') renderBannerFields(item, card);
      else {
        const active = element('input', { attributes: { type: 'checkbox' } });
        active.checked = item.is_active !== false;
        active.addEventListener('change', () => (item.is_active = active.checked));
        const up = button('上移', () => moveContent(category, index, -1));
        up.disabled = index === 0;
        const down = button('下移', () => moveContent(category, index, 1));
        down.disabled = index === rows.length - 1;
        card.append(element('div', { className: 'admin-canonical-state' }, [field('启用', active), up, down]));
        renderGallery(item, card);
      }
      grid.append(card);
    });
    if (!rows.length) grid.append(element('p', { className: 'admin-feedback', text: '当前没有可管理内容。' }));
    section.append(grid);
    if (category !== 'banner') {
      section.append(
        button('保存本区排序与状态', () =>
          run(`${label}排序与状态`, async () => {
            const ordered = records
              .filter((item) => item.category === category)
              .sort((a, b) => a.slot_index - b.slot_index);
            await saveHomeContentOrder(client, category, ordered);
          })
        )
      );
    }
    return section;
  }

  function render() {
    wrapper.replaceChildren(...categories.map(([category, label]) => renderCategory(category, label)));
  }

  async function load() {
    wrapper.replaceChildren(element('p', { className: 'admin-feedback', text: '正在加载 canonical 内容管理…' }));
    const result = await client
      .from('content_management')
      .select('*')
      .in(
        'category',
        categories.map(([category]) => category)
      )
      .order('category')
      .order('slot_index');
    if (result.error) throw result.error;
    records = result.data || [];
    render();
  }

  function destroy() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  return { load, destroy };
}
