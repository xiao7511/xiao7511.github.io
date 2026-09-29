export const CONTENT_IMAGE_BUCKET = 'images';
export const CONTENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CONTENT_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

const extensions = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});

export function validateContentImage(file) {
  const extension = extensions[file?.type];
  if (!extension) throw new Error('INVALID_CONTENT_IMAGE_TYPE');
  if (!Number.isFinite(file?.size) || file.size <= 0 || file.size > CONTENT_IMAGE_MAX_BYTES) {
    throw new Error('INVALID_CONTENT_IMAGE_SIZE');
  }
  return extension;
}

export function contentImageObjectPath(item, extension, kind = 'cover') {
  if (!['cover', 'gallery'].includes(kind)) throw new Error('INVALID_CONTENT_IMAGE_KIND');
  const category = String(item?.category || '')
    .replace(/[^a-z0-9_-]/gi, '-')
    .toLowerCase();
  const contentId = String(item?.id || '')
    .replace(/[^a-z0-9_-]/gi, '-')
    .toLowerCase();
  if (!category || !contentId) throw new Error('INVALID_CONTENT_IDENTITY');
  return `content-management/${category}/${contentId}/${kind}/${crypto.randomUUID()}.${extension}`;
}

async function uploadImage(client, item, file, kind) {
  const extension = validateContentImage(file);
  const path = contentImageObjectPath(item, extension, kind);
  const bucket = client.storage.from(CONTENT_IMAGE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  if (!publicUrl) {
    await bucket.remove([path]).catch(() => undefined);
    throw new Error('MISSING_CONTENT_IMAGE_URL');
  }
  return { bucket, path, publicUrl };
}

function rowUpdate(client, item, changes, columns) {
  return client
    .from('content_management')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('category', item.category)
    .select(columns)
    .maybeSingle();
}

export async function saveContentCover(client, item, file, onStage) {
  onStage?.('uploading');
  const uploaded = await uploadImage(client, item, file, 'cover');
  try {
    onStage?.('saving');
    const result = await rowUpdate(client, item, { cover_url: uploaded.publicUrl }, 'id,cover_url');
    if (result.error || !result.data) throw result.error || new Error('CONTENT_IMAGE_ROW_NOT_FOUND');
    // Match Mobile: old objects are retained because another row may still reference them.
    return uploaded.publicUrl;
  } catch (error) {
    await uploaded.bucket.remove([uploaded.path]).catch(() => undefined);
    throw error;
  }
}

export async function saveContentGallery(client, item, entries, onStage) {
  const bucket = client.storage.from(CONTENT_IMAGE_BUCKET);
  const uploadedPaths = [];
  const nextUrls = [];
  const uploadTotal = entries.filter((entry) => entry.file).length;
  let uploadCurrent = 0;
  try {
    for (const entry of entries) {
      if (!entry.file) {
        const existingUrl = String(entry.existingUrl || '').trim();
        if (!existingUrl) throw new Error('INVALID_GALLERY_ENTRY');
        nextUrls.push(existingUrl);
        continue;
      }
      uploadCurrent += 1;
      onStage?.('uploading', uploadCurrent, uploadTotal);
      const uploaded = await uploadImage(client, item, entry.file, 'gallery');
      uploadedPaths.push(uploaded.path);
      nextUrls.push(uploaded.publicUrl);
    }
    onStage?.('saving', uploadTotal, uploadTotal);
    const result = await rowUpdate(client, item, { detail_urls: nextUrls }, 'id,detail_urls');
    if (result.error || !result.data) throw result.error || new Error('CONTENT_GALLERY_ROW_NOT_FOUND');
    const persisted = result.data.detail_urls;
    return Array.isArray(persisted) && persisted.every((url) => typeof url === 'string') ? persisted : nextUrls;
  } catch (error) {
    if (uploadedPaths.length) await bucket.remove(uploadedPaths).catch(() => undefined);
    throw error;
  }
}

const editableFields = new Set(['title', 'subtitle', 'theme_tags', 'slot_index', 'is_active', 'linked_content_id']);

export async function updateContentFields(client, item, changes) {
  const isolated = Object.fromEntries(Object.entries(changes).filter(([key]) => editableFields.has(key)));
  if (!Object.keys(isolated).length) throw new Error('NO_CONTENT_CHANGES');
  const result = await rowUpdate(
    client,
    item,
    isolated,
    'id,title,subtitle,theme_tags,slot_index,is_active,linked_content_id'
  );
  if (result.error || !result.data) throw result.error || new Error('CONTENT_ROW_NOT_FOUND');
  return result.data;
}

export async function saveHomeContentOrder(client, category, items) {
  if (!['anime', 'manga'].includes(category)) throw new Error('INVALID_CONTENT_CATEGORY');
  if (items.filter((item) => item.is_active !== false).length > 6) throw new Error('ACTIVE_CONTENT_LIMIT');
  const result = await client.rpc('save_home_content_order', {
    p_category: category,
    p_items: items.map((item, index) => ({
      id: item.id,
      slot_index: index,
      is_active: item.is_active !== false
    }))
  });
  if (result.error) throw result.error;
}
