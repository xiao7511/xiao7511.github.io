export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const AVATAR_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export function validateAvatar(file) {
  if (!file || !AVATAR_TYPES.includes(file.type)) throw new Error('INVALID_AVATAR_TYPE');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    throw new Error('INVALID_AVATAR_SIZE');
  }
  return AVATAR_EXTENSIONS[file.type];
}

export function ownedAvatarPath(url, userId, expectedPublicUrl) {
  if (!url) return null;
  try {
    const current = new URL(url);
    const expected = new URL(expectedPublicUrl);
    if (current.origin !== expected.origin) return null;
    const marker = '/storage/v1/object/public/avatars/';
    if (!current.pathname.startsWith(marker)) return null;
    const path = decodeURIComponent(current.pathname.slice(marker.length));
    const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const legacyPath = new RegExp(`^${escapedUserId}\\.(jpg|jpeg|png|webp)$`, 'i');
    return path.startsWith(`${userId}/`) || legacyPath.test(path) ? path : null;
  } catch {
    return null;
  }
}

export async function updateAvatar(client, userId, previousUrl, file) {
  const extension = validateAvatar(file);
  const bucket = client.storage.from('avatars');
  const path = `${userId}/${globalThis.crypto.randomUUID()}.${extension}`;
  const upload = await bucket.upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });
  if (upload.error) throw upload.error;

  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  if (!publicUrl) {
    await bucket.remove([path]).catch(() => undefined);
    throw new Error('MISSING_AVATAR_URL');
  }

  const profileUpdate = await client
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (profileUpdate.error || !profileUpdate.data) {
    await bucket.remove([path]).catch(() => undefined);
    throw profileUpdate.error || new Error('PROFILE_NOT_PROVISIONED');
  }

  const oldPath = ownedAvatarPath(previousUrl, userId, publicUrl);
  if (oldPath && oldPath !== path) await bucket.remove([oldPath]).catch(() => undefined);
  return publicUrl;
}
