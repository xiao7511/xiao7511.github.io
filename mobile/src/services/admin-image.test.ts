import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import {
  contentImageObjectPath,
  saveAdminContentImage,
  saveAdminDetailGallery,
  validateContentImage
} from './admin-image';
import type { ContentItem } from '../types/content';

const item = { id: 'content-1', category: 'anime', slot_index: 0, title: 'NOBI' } as ContentItem;
const file = { type: 'image/webp', size: 2048 } as File;

function clientWith(updateResult: { data: unknown; error: Error | null }) {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'new.webp' }, error: null });
  const remove = vi.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingle = vi.fn().mockResolvedValue(updateResult);
  const select = vi.fn(() => ({ maybeSingle }));
  const categoryEq = vi.fn(() => ({ select }));
  const idEq = vi.fn(() => ({ eq: categoryEq }));
  const update = vi.fn(() => ({ eq: idEq }));
  const bucket = {
    upload,
    remove,
    getPublicUrl: vi.fn(() => ({
      data: { publicUrl: 'https://api.nobistudio.com/storage/v1/object/public/images/new.webp' }
    }))
  };
  return {
    client: { storage: { from: vi.fn(() => bucket) }, from: vi.fn(() => ({ update })) } as unknown as SupabaseClient,
    upload,
    remove,
    update,
    idEq,
    categoryEq
  };
}

describe('administrator content image replacement', () => {
  test('validates image type and size and uses a unique content-management path', () => {
    expect(validateContentImage(file)).toBe('webp');
    expect(() => validateContentImage({ type: 'image/svg+xml', size: 10 })).toThrow('INVALID_CONTENT_IMAGE_TYPE');
    expect(() => validateContentImage({ type: 'image/png', size: 11 * 1024 * 1024 })).toThrow(
      'INVALID_CONTENT_IMAGE_SIZE'
    );
    expect(contentImageObjectPath(item, 'webp')).toMatch(/^content-management\/anime\/content-1\/cover\/.+\.webp$/);
  });

  test('updates the existing row but retains old objects that may be shared', async () => {
    const state = clientWith({ data: { id: item.id, cover_url: 'new' }, error: null });
    const stages: string[] = [];
    await expect(saveAdminContentImage(state.client, item, file, {}, (stage) => stages.push(stage))).resolves.toContain(
      '/storage/v1/object/public/images/'
    );
    expect(stages).toEqual(['uploading', 'saving']);
    expect(state.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^content-management\/anime\/content-1\/cover\//),
      file,
      {
        cacheControl: '31536000',
        contentType: 'image/webp',
        upsert: false
      }
    );
    expect(state.idEq).toHaveBeenCalledWith('id', item.id);
    expect(state.categoryEq).toHaveBeenCalledWith('category', item.category);
    expect(state.remove).not.toHaveBeenCalled();
  });

  test('removes only the new object when the database update fails', async () => {
    const state = clientWith({ data: null, error: new Error('database rejected update') });
    await expect(saveAdminContentImage(state.client, item, file)).rejects.toThrow('database rejected update');
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^content-management\/anime\/content-1\/cover\//)
    ]);
  });

  test('rolls back every newly uploaded gallery object when detail_urls persistence fails', async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const bucket = {
      upload,
      remove,
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://api.nobistudio.com/storage/v1/object/public/images/${path}` }
      }))
    };
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('detail_urls rejected') })
          }))
        }))
      }))
    }));
    const client = {
      storage: { from: vi.fn(() => bucket) },
      from: vi.fn(() => ({ update }))
    } as unknown as SupabaseClient;

    await expect(saveAdminDetailGallery(client, item, [{ file }, { file }])).rejects.toThrow('detail_urls rejected');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^content-management\/anime\/content-1\/gallery\//),
      expect.stringMatching(/^content-management\/anime\/content-1\/gallery\//)
    ]);
  });

  for (const category of ['anime', 'manga'] as const) {
    test(`persists ${category} cover plus gallery add, replace and delete operations`, async () => {
      const content = { ...item, id: `${category}-content`, category };
      const coverState = clientWith({ data: { id: content.id, cover_url: 'new' }, error: null });
      await saveAdminContentImage(coverState.client, content, file);
      expect(coverState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cover_url: 'https://api.nobistudio.com/storage/v1/object/public/images/new.webp'
        })
      );

      const oldA = `https://api.nobistudio.com/storage/v1/object/public/images/${category}-a.webp`;
      const oldB = `https://api.nobistudio.com/storage/v1/object/public/images/${category}-b.webp`;
      const createGalleryClient = () => {
        const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
        const remove = vi.fn().mockResolvedValue({ data: null, error: null });
        const update = vi.fn((changes: { detail_urls: string[] }) => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: content.id, ...changes }, error: null })
              }))
            }))
          }))
        }));
        const bucket = {
          upload,
          remove,
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://api.nobistudio.com/storage/v1/object/public/images/${path}` }
          }))
        };
        return {
          client: {
            storage: { from: vi.fn(() => bucket) },
            from: vi.fn(() => ({ update }))
          } as unknown as SupabaseClient,
          upload,
          remove,
          update
        };
      };

      const addState = createGalleryClient();
      const added = await saveAdminDetailGallery(addState.client, content, [
        { existingUrl: oldA },
        { existingUrl: oldB },
        { file }
      ]);
      expect(added.slice(0, 2)).toEqual([oldA, oldB]);
      expect(added[2]).toMatch(
        new RegExp(`/content-management/${category}/${content.id}/gallery/[0-9a-f-]+\\.webp$`, 'i')
      );

      const replaceState = createGalleryClient();
      const replaced = await saveAdminDetailGallery(replaceState.client, content, [
        { existingUrl: oldA },
        { existingUrl: oldB, file }
      ]);
      expect(replaced[0]).toBe(oldA);
      expect(replaced[1]).not.toBe(oldB);
      expect(replaceState.remove).not.toHaveBeenCalled();

      const deleteState = createGalleryClient();
      const deleted = await saveAdminDetailGallery(deleteState.client, content, [{ existingUrl: oldB }]);
      expect(deleted).toEqual([oldB]);
      expect(deleteState.update).toHaveBeenCalledWith(expect.objectContaining({ detail_urls: [oldB] }));
      expect(deleteState.upload).not.toHaveBeenCalled();
      expect(deleteState.remove).not.toHaveBeenCalled();
    });
  }
});
