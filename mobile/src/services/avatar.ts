import type { SupabaseClient } from '@supabase/supabase-js';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const extensions: Record<(typeof AVATAR_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export function validateAvatar(file: Pick<File, 'type' | 'size'>): string {
  if (!AVATAR_TYPES.includes(file.type as (typeof AVATAR_TYPES)[number])) throw new Error('INVALID_AVATAR_TYPE');
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) throw new Error('INVALID_AVATAR_SIZE');
  return extensions[file.type as (typeof AVATAR_TYPES)[number]];
}

export function ownedAvatarPath(
  url: string | null | undefined,
  userId: string,
  expectedPublicUrl: string
): string | null {
  if (!url) return null;
  try {
    const current = new URL(url);
    const expected = new URL(expectedPublicUrl);
    if (current.origin !== expected.origin) return null;
    const marker = '/storage/v1/object/public/avatars/';
    if (!current.pathname.startsWith(marker)) return null;
    const path = decodeURIComponent(current.pathname.slice(marker.length));
    const legacy = new RegExp(`^${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(jpg|jpeg|png|webp)$`, 'i');
    return path.startsWith(`${userId}/`) || legacy.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function avatarDisplayUrl(url: string, version: number = Date.now()): string {
  const parsed = new URL(url);
  parsed.searchParams.set('v', String(version));
  return parsed.href;
}

export async function updateAvatar(
  client: SupabaseClient,
  userId: string,
  previousUrl: string | null | undefined,
  file: File
): Promise<string> {
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

  const profileUpdate = await client.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  if (profileUpdate.error) {
    await bucket.remove([path]).catch(() => undefined);
    throw profileUpdate.error;
  }

  const oldPath = ownedAvatarPath(previousUrl, userId, publicUrl);
  if (oldPath && oldPath !== path) await bucket.remove([oldPath]).catch(() => undefined);
  return publicUrl;
}
