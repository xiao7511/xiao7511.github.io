import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import {
  REPLY_IMAGE_MAX_BYTES,
  uploadReplyImage,
  validateReplyImage
} from '../public/assets/js/src/community/reply-images.js';

describe('Web community reply images', () => {
  test('rejects unsupported MIME types and files over 5MB', () => {
    expect(validateReplyImage({ type: 'image/jpeg', size: 10 })).toBe('jpg');
    expect(() => validateReplyImage({ type: 'image/gif', size: 10 })).toThrow('JPEG');
    expect(() => validateReplyImage({ type: 'image/webp', size: REPLY_IMAGE_MAX_BYTES + 1 })).toThrow('5MB');
  });

  test('uploads a UUID object under the current user directory', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const bucket = { upload, getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn/${path}` } }) };
    const client = { storage: { from: vi.fn(() => bucket) } };
    const file = { type: 'image/png', size: 200, name: 'original.png' };
    const result = await uploadReplyImage(client, 'user-id', file);
    expect(result.path).toMatch(/^community-replies\/user-id\/[0-9a-f-]+\.png$/);
    expect(result.path).not.toContain('original');
    expect(upload).toHaveBeenCalledWith(result.path, file, expect.objectContaining({ upsert: false }));
  });

  test('migration enforces bucket MIME, size and authenticated folder policies', async () => {
    const sql = await readFile(
      new URL('../supabase/migrations/202609270002_community_reply_images.sql', import.meta.url),
      'utf8'
    );
    expect(sql).toContain('5242880');
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(sql).toContain('(storage.foldername(name))[2] = auth.uid()::text');
  });
});
