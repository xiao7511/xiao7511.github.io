export const REPLY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function validateReplyImage(file) {
  const extension = extensions[file?.type];
  if (!extension) throw new Error('不支持该图片格式，请选择 JPEG、PNG 或 WebP 图片');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > REPLY_IMAGE_MAX_BYTES) {
    throw new Error('图片不能超过 5MB');
  }
  return extension;
}

export async function uploadReplyImage(client, userId, file) {
  const extension = validateReplyImage(file);
  const path = `community-replies/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from('community').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  const url = client.storage.from('community').getPublicUrl(path).data.publicUrl;
  return { path, url };
}

export async function removeReplyImage(client, path) {
  const { error } = await client.storage.from('community').remove([path]);
  if (error) throw error;
}

export async function createReplyWithOptionalImage(client, { userId, file, createReply }) {
  let uploaded = null;
  try {
    if (file) uploaded = await uploadReplyImage(client, userId, file);
    await createReply(uploaded?.path || null);
    return uploaded;
  } catch (error) {
    if (uploaded) {
      try {
        await removeReplyImage(client, uploaded.path);
      } catch (cleanupError) {
        error.cleanupError = cleanupError;
      }
    }
    throw error;
  }
}
