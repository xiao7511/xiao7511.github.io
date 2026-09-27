export const REPLY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function validateReplyImage(file) {
  const extension = extensions[file?.type];
  if (!extension) throw new Error('仅支持 JPEG、PNG 或 WebP 图片');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > REPLY_IMAGE_MAX_BYTES) {
    throw new Error('图片大小必须小于或等于 5MB');
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
