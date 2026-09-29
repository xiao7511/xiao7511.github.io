import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import {
  CONTENT_IMAGE_MAX_BYTES,
  contentImageObjectPath,
  saveContentCover,
  saveContentGallery,
  updateContentFields,
  validateContentImage
} from '../public/assets/js/src/admin/content-management.js';

const banner = {
  id: '5a0f1c6f-3c6e-4e71-a65d-6a5504945b82',
  category: 'banner',
  cover_url: 'https://project.supabase.co/storage/v1/object/public/images/old-banner.webp',
  detail_urls: ['https://project.supabase.co/storage/v1/object/public/images/unchanged-detail.webp'],
  linked_content_id: 'd9428888-122b-4f20-9f6c-25789ab0a123'
};

const anime = {
  id: 'd9428888-122b-4f20-9f6c-25789ab0a123',
  category: 'anime',
  cover_url: 'https://project.supabase.co/storage/v1/object/public/images/old-cover.webp',
  detail_urls: [
    'https://project.supabase.co/storage/v1/object/public/images/old-a.webp',
    'https://project.supabase.co/storage/v1/object/public/images/old-b.webp'
  ]
};

function clientWith({ updateError = null, updateData } = {}) {
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const getPublicUrl = vi.fn((path) => ({
    data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/images/${path}` }
  }));
  const bucket = { upload, remove, getPublicUrl };
  const updates = [];
  const maybeSingle = vi.fn(async () => ({ data: updateData ?? updates.at(-1), error: updateError }));
  const select = vi.fn(() => ({ maybeSingle }));
  const categoryEq = vi.fn(() => ({ select }));
  const idEq = vi.fn(() => ({ eq: categoryEq }));
  const update = vi.fn((changes) => {
    updates.push(changes);
    return { eq: idEq };
  });
  const client = {
    storage: { from: vi.fn(() => bucket) },
    from: vi.fn(() => ({ update }))
  };
  return { client, bucket, upload, remove, update, updates };
}

describe('Web canonical administrator content management', () => {
  test('updates a Banner cover through its canonical path without polluting metadata or detail_urls', async () => {
    const state = clientWith({ updateData: { id: banner.id, cover_url: 'saved' } });
    const file = { type: 'image/webp', size: 200 };
    await saveContentCover(state.client, banner, file);

    const path = state.upload.mock.calls[0][0];
    expect(path).toMatch(/^content-management\/banner\/5a0f1c6f-3c6e-4e71-a65d-6a5504945b82\/cover\/[0-9a-f-]+\.webp$/);
    expect(state.upload).toHaveBeenCalledWith(path, file, expect.objectContaining({ upsert: false }));
    expect(state.update).toHaveBeenCalledWith({
      cover_url: expect.stringContaining(`/images/${path}`),
      updated_at: expect.any(String)
    });
    expect(state.update.mock.calls[0][0]).not.toHaveProperty('detail_urls');
    expect(state.update.mock.calls[0][0]).not.toHaveProperty('linked_content_id');
    expect(state.update.mock.calls[0][0]).not.toHaveProperty('title');
    expect(state.remove).not.toHaveBeenCalled();
  });

  test('preserves linked_content_id unless association is intentionally updated', async () => {
    const coverState = clientWith({ updateData: { id: banner.id, cover_url: 'saved' } });
    await saveContentCover(coverState.client, banner, { type: 'image/png', size: 100 });
    expect(coverState.update.mock.calls[0][0]).not.toHaveProperty('linked_content_id');

    const associationState = clientWith({
      updateData: { id: banner.id, linked_content_id: anime.id }
    });
    await updateContentFields(associationState.client, banner, { linked_content_id: anime.id });
    expect(associationState.update).toHaveBeenCalledWith({
      linked_content_id: anime.id,
      updated_at: expect.any(String)
    });
  });

  test.each(['anime', 'manga'])(
    '%s cover replacement is isolated and retains an unproven shared old object',
    async (category) => {
      const item = { ...anime, category };
      const state = clientWith({ updateData: { id: item.id, cover_url: 'saved' } });
      await saveContentCover(state.client, item, { type: 'image/jpeg', size: 100 });
      expect(state.upload.mock.calls[0][0]).toMatch(
        new RegExp(`^content-management/${category}/${item.id}/cover/[0-9a-f-]+\\.jpg$`)
      );
      expect(state.update.mock.calls[0][0]).not.toHaveProperty('detail_urls');
      expect(state.remove).not.toHaveBeenCalled();
    }
  );

  test('persists Gallery add, replace, delete and reorder as one isolated detail_urls update', async () => {
    const state = clientWith();
    const replacement = { type: 'image/png', size: 100 };
    const added = { type: 'image/webp', size: 100 };
    const result = await saveContentGallery(state.client, anime, [
      { file: replacement },
      { existingUrl: anime.detail_urls[0] },
      { file: added }
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatch(/\/gallery\/[0-9a-f-]+\.png$/);
    expect(result[1]).toBe(anime.detail_urls[0]);
    expect(result[2]).toMatch(/\/gallery\/[0-9a-f-]+\.webp$/);
    expect(result).not.toContain(anime.detail_urls[1]);
    expect(state.update.mock.calls[0][0]).toEqual({ detail_urls: result, updated_at: expect.any(String) });
    expect(state.update.mock.calls[0][0]).not.toHaveProperty('cover_url');
    expect(state.remove).not.toHaveBeenCalled();
  });

  test('removes every new object after a database failure and never touches the old canonical state', async () => {
    const failure = new Error('database rejected update');
    const state = clientWith({ updateError: failure, updateData: null });
    await expect(
      saveContentGallery(state.client, anime, [
        { existingUrl: anime.detail_urls[0] },
        { file: { type: 'image/jpeg', size: 100 } },
        { file: { type: 'image/webp', size: 100 } }
      ])
    ).rejects.toThrow('database rejected update');

    const uploadedPaths = state.upload.mock.calls.map(([path]) => path);
    expect(state.remove).toHaveBeenCalledWith(uploadedPaths);
    expect(state.update.mock.calls[0][0].detail_urls[0]).toBe(anime.detail_urls[0]);
    expect(state.remove.mock.calls[0][0]).not.toContain('old-a.webp');
  });

  test('removes a newly uploaded cover when persistence fails', async () => {
    const state = clientWith({ updateError: new Error('save failed'), updateData: null });
    await expect(saveContentCover(state.client, anime, { type: 'image/png', size: 100 })).rejects.toThrow(
      'save failed'
    );
    expect(state.remove).toHaveBeenCalledWith([state.upload.mock.calls[0][0]]);
  });

  test('accepts only the Mobile canonical image formats and rejects video or oversized files', () => {
    expect(validateContentImage({ type: 'image/jpeg', size: 1 })).toBe('jpg');
    expect(validateContentImage({ type: 'image/png', size: CONTENT_IMAGE_MAX_BYTES })).toBe('png');
    expect(validateContentImage({ type: 'image/webp', size: 1 })).toBe('webp');
    expect(() => validateContentImage({ type: 'video/mp4', size: 100 })).toThrow('INVALID_CONTENT_IMAGE_TYPE');
    expect(() => validateContentImage({ type: 'image/gif', size: 100 })).toThrow('INVALID_CONTENT_IMAGE_TYPE');
    expect(() => validateContentImage({ type: 'image/png', size: CONTENT_IMAGE_MAX_BYTES + 1 })).toThrow(
      'INVALID_CONTENT_IMAGE_SIZE'
    );
  });

  test('never creates an active legacy root-path identity', () => {
    for (const category of ['banner', 'anime', 'manga']) {
      const path = contentImageObjectPath({ id: anime.id, category }, 'webp');
      expect(path).toMatch(new RegExp(`^content-management/${category}/${anime.id}/cover/`));
      expect(path).not.toMatch(/^(?:banner|anime|manga)_slot_/);
    }
  });

  test('boots the canonical editor without activating either legacy Web writer', async () => {
    const html = await readFile(new URL('../public/admin.html', import.meta.url), 'utf8');
    const activeBootstrap = html.slice(
      html.indexOf('async function initWorkflow'),
      html.indexOf('async function verifyAdminAuth')
    );
    const module = await readFile(new URL('../public/assets/js/admin-v2.js', import.meta.url), 'utf8');
    expect(activeBootstrap).not.toContain('activateUploadListener(supabaseUrl)');
    expect(activeBootstrap).not.toContain('refreshLiveDashboard(supabaseUrl)');
    expect(module).toContain('createCanonicalContentEditor');
    expect(module).toContain('disableLegacyAdminWrites');
  });
});
