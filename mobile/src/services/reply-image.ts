import type { SupabaseClient } from '@supabase/supabase-js';

export const REPLY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const REPLY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const extensions: Record<(typeof REPLY_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export function validateReplyImage(file: Pick<File, 'type' | 'size'>): string {
  if (!REPLY_IMAGE_TYPES.includes(file.type as (typeof REPLY_IMAGE_TYPES)[number])) throw new Error('INVALID_IMAGE_TYPE');
  if (file.size <= 0 || file.size > REPLY_IMAGE_MAX_BYTES) throw new Error('INVALID_IMAGE_SIZE');
  return extensions[file.type as (typeof REPLY_IMAGE_TYPES)[number]];
}

export async function uploadReplyImage(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string; url: string }> {
  const extension = validateReplyImage(file);
  const path = `community-replies/${userId}/${globalThis.crypto.randomUUID()}.${extension}`;
  const upload = await client.storage.from('community').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });
  if (upload.error) throw upload.error;
  const publicUrl = client.storage.from('community').getPublicUrl(path).data.publicUrl;
  if (!publicUrl) throw new Error('MISSING_PUBLIC_URL');
  return { path, url: publicUrl };
}

export async function removeReplyImage(client: SupabaseClient, path: string): Promise<void> {
  const result = await client.storage.from('community').remove([path]);
  if (result.error) throw result.error;
}
