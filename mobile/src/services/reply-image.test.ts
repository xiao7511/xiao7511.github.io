import type { SupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { REPLY_IMAGE_MAX_BYTES, uploadReplyImage, validateReplyImage } from './reply-image';

describe('community reply images', () => {
  test('accepts only JPEG, PNG and WebP up to 5MB', () => {
    expect(validateReplyImage({ type: 'image/jpeg', size: 100 })).toBe('jpg');
    expect(validateReplyImage({ type: 'image/png', size: REPLY_IMAGE_MAX_BYTES })).toBe('png');
    expect(() => validateReplyImage({ type: 'image/gif', size: 100 })).toThrow('INVALID_IMAGE_TYPE');
    expect(() => validateReplyImage({ type: 'image/webp', size: REPLY_IMAGE_MAX_BYTES + 1 })).toThrow(
      'INVALID_IMAGE_SIZE'
    );
  });

  test('uploads to the authenticated user directory without using the original filename', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const bucket = { upload, getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn/${path}` } })) };
    const client = { storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient;
    const file = { type: 'image/webp', size: 200, name: 'private-name.webp' } as Parameters<
      typeof uploadReplyImage
    >[2];
    const result = await uploadReplyImage(client, 'user-123', file);
    expect(result.path).toMatch(/^community-replies\/user-123\/[0-9a-f-]+\.webp$/);
    expect(result.path).not.toContain('private-name');
    expect(upload).toHaveBeenCalledWith(result.path, file, expect.objectContaining({ upsert: false }));
  });

  test('migration binds writes to the authenticated user folder and server MIME limits', async () => {
    const sql = await readFile(
      new URL('../../../supabase/migrations/202609270002_community_reply_images.sql', import.meta.url),
      'utf8'
    );
    expect(sql).toContain("(storage.foldername(name))[2] = auth.uid()::text");
    expect(sql).not.toContain('on conflict (id) do update');
    expect(sql).toContain('existing community bucket configuration requires manual review');
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(sql).toContain("image_path like 'community-replies/' || user_id::text || '/%'");
  });
});
