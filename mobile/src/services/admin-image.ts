import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentItem } from '../types/content';

export const CONTENT_IMAGE_BUCKET = 'images';
export const CONTENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CONTENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const extensions: Record<(typeof CONTENT_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export type AdminImageSaveStage = 'uploading' | 'saving';

export interface AdminGalleryDraftEntry {
  existingUrl?: string | null;
  file?: File;
}

export function validateContentImage(file: Pick<File, 'type' | 'size'>): string {
  if (!CONTENT_IMAGE_TYPES.includes(file.type as (typeof CONTENT_IMAGE_TYPES)[number])) {
    throw new Error('INVALID_CONTENT_IMAGE_TYPE');
  }
  if (file.size <= 0 || file.size > CONTENT_IMAGE_MAX_BYTES) throw new Error('INVALID_CONTENT_IMAGE_SIZE');
  return extensions[file.type as (typeof CONTENT_IMAGE_TYPES)[number]];
}

export function contentImageObjectPath(
  item: Pick<ContentItem, 'id' | 'category'>,
  extension: string,
  kind: 'cover' | 'gallery' = 'cover'
): string {
  const category = item.category.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const contentId = item.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return `content-management/${category}/${contentId}/${kind}/${globalThis.crypto.randomUUID()}.${extension}`;
}

export async function saveAdminContentImage(
  client: SupabaseClient,
  item: ContentItem,
  file: File,
  changes: Partial<Pick<ContentItem, 'title' | 'subtitle' | 'slot_index' | 'linked_content_id'>> = {},
  onStage?: (stage: AdminImageSaveStage) => void
): Promise<string> {
  const extension = validateContentImage(file);
  const bucket = client.storage.from(CONTENT_IMAGE_BUCKET);
  const path = contentImageObjectPath(item, extension);

  onStage?.('uploading');
  const upload = await bucket.upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });
  if (upload.error) throw upload.error;

  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  if (!publicUrl) {
    await bucket.remove([path]).catch(() => undefined);
    throw new Error('MISSING_CONTENT_IMAGE_URL');
  }

  onStage?.('saving');
  const update = await client
    .from('content_management')
    .update({ ...changes, cover_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('category', item.category)
    .select('id,cover_url')
    .maybeSingle();
  if (update.error || !update.data) {
    await bucket.remove([path]).catch(() => undefined);
    throw update.error ?? new Error('CONTENT_IMAGE_ROW_NOT_FOUND');
  }

  // The previous object is deliberately retained: another content row may still reference it.
  return publicUrl;
}

export async function saveAdminDetailGallery(
  client: SupabaseClient,
  item: ContentItem,
  entries: AdminGalleryDraftEntry[],
  onStage?: (stage: AdminImageSaveStage, current: number, total: number) => void
): Promise<string[]> {
  const bucket = client.storage.from(CONTENT_IMAGE_BUCKET);
  const uploadedPaths: string[] = [];
  const nextUrls: string[] = [];
  const uploadTotal = entries.filter((entry) => entry.file).length;
  let uploadCurrent = 0;

  try {
    for (const entry of entries) {
      if (!entry.file) {
        const existingUrl = entry.existingUrl?.trim();
        if (!existingUrl) throw new Error('INVALID_GALLERY_ENTRY');
        nextUrls.push(existingUrl);
        continue;
      }

      const extension = validateContentImage(entry.file);
      const path = contentImageObjectPath(item, extension, 'gallery');
      uploadCurrent += 1;
      onStage?.('uploading', uploadCurrent, uploadTotal);
      const upload = await bucket.upload(path, entry.file, {
        cacheControl: '31536000',
        contentType: entry.file.type,
        upsert: false
      });
      if (upload.error) throw upload.error;
      uploadedPaths.push(path);
      const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
      if (!publicUrl) throw new Error('MISSING_CONTENT_IMAGE_URL');
      nextUrls.push(publicUrl);
    }

    onStage?.('saving', uploadTotal, uploadTotal);
    const update = await client
      .from('content_management')
      .update({ detail_urls: nextUrls, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('category', item.category)
      .select('id,detail_urls')
      .maybeSingle();
    if (update.error || !update.data) throw update.error ?? new Error('CONTENT_GALLERY_ROW_NOT_FOUND');

    const persisted = (update.data as { detail_urls?: unknown }).detail_urls;
    return Array.isArray(persisted) && persisted.every((url) => typeof url === 'string')
      ? (persisted as string[])
      : nextUrls;
  } catch (cause) {
    if (uploadedPaths.length) await bucket.remove(uploadedPaths).catch(() => undefined);
    throw cause;
  }
}
