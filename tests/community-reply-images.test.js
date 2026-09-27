import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import {
  createReplyWithOptionalImage,
  REPLY_IMAGE_MAX_BYTES,
  uploadReplyImage,
  validateReplyImage
} from '../public/assets/js/src/community/reply-images.js';

describe('Web community reply images', () => {
  test('accepts JPEG, PNG and WebP up to 5MB and rejects invalid files with exact messages', () => {
    expect(validateReplyImage({ type: 'image/jpeg', size: 10 })).toBe('jpg');
    expect(validateReplyImage({ type: 'image/png', size: REPLY_IMAGE_MAX_BYTES })).toBe('png');
    expect(validateReplyImage({ type: 'image/webp', size: 10 })).toBe('webp');
    expect(() => validateReplyImage({ type: 'image/gif', size: 10 })).toThrow(
      '不支持该图片格式，请选择 JPEG、PNG 或 WebP 图片'
    );
    expect(() => validateReplyImage({ type: 'image/webp', size: REPLY_IMAGE_MAX_BYTES + 1 })).toThrow(
      '图片不能超过 5MB'
    );
  });

  test('persists image_path only after upload succeeds', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const bucket = {
      upload,
      remove: vi.fn(async () => ({ error: null })),
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn/${path}` } })
    };
    const client = { storage: { from: vi.fn(() => bucket) } };
    const createReply = vi.fn(async () => undefined);
    const file = { type: 'image/webp', size: 200, name: 'reply.webp' };

    const uploaded = await createReplyWithOptionalImage(client, { userId: 'user-id', file, createReply });

    expect(createReply).toHaveBeenCalledWith(uploaded.path);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  test('removes an uploaded object when reply creation fails', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({ error: null }));
    const bucket = {
      upload,
      remove,
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn/${path}` } })
    };
    const client = { storage: { from: vi.fn(() => bucket) } };
    const file = { type: 'image/jpeg', size: 200, name: 'reply.jpg' };

    await expect(
      createReplyWithOptionalImage(client, {
        userId: 'user-id',
        file,
        createReply: async () => {
          throw new Error('insert failed');
        }
      })
    ).rejects.toThrow('insert failed');

    expect(remove).toHaveBeenCalledOnce();
    expect(remove.mock.calls[0][0]).toEqual([expect.stringMatching(/^community-replies\/user-id\/[0-9a-f-]+\.jpg$/)]);
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
