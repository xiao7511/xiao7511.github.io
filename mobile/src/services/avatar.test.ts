import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { AVATAR_MAX_BYTES, avatarDisplayUrl, ownedAvatarPath, updateAvatar, validateAvatar } from './avatar';

function avatarClient(profileError: unknown = null) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const publicUrl = 'https://project.supabase.co/storage/v1/object/public/avatars/user-a/new.png';
  const bucket = { upload, remove, getPublicUrl: vi.fn(() => ({ data: { publicUrl } })) };
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-a' }, error: profileError });
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const client = {
    storage: { from: vi.fn(() => bucket) },
    from: vi.fn(() => ({ update }))
  } as unknown as SupabaseClient;
  return { client, upload, remove, update, eq, select, maybeSingle, publicUrl };
}

describe('avatar service', () => {
  test('accepts JPEG, PNG and WebP up to 5MB', () => {
    expect(validateAvatar({ type: 'image/jpeg', size: 1 })).toBe('jpg');
    expect(validateAvatar({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBe('png');
    expect(validateAvatar({ type: 'image/webp', size: 1 })).toBe('webp');
    expect(() => validateAvatar({ type: 'image/gif', size: 1 })).toThrow('INVALID_AVATAR_TYPE');
    expect(() => validateAvatar({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toThrow('INVALID_AVATAR_SIZE');
  });

  test('uploads to the current user directory and updates profiles.avatar_url', async () => {
    const state = avatarClient();
    const file = { type: 'image/png', size: 100 } as File;
    await expect(updateAvatar(state.client, 'user-a', null, file)).resolves.toBe(state.publicUrl);
    expect(state.upload.mock.calls[0][0]).toMatch(/^user-a\/[0-9a-f-]+\.png$/);
    expect(state.upload).toHaveBeenCalledWith(expect.any(String), file, expect.objectContaining({ upsert: false }));
    expect(state.update).toHaveBeenCalledWith({ avatar_url: state.publicUrl });
    expect(state.eq).toHaveBeenCalledWith('id', 'user-a');
    expect(state.select).toHaveBeenCalledWith('id');
  });

  test('removes the new object when profile update fails', async () => {
    const state = avatarClient(new Error('profile failed'));
    await expect(updateAvatar(state.client, 'user-a', null, { type: 'image/jpeg', size: 100 } as File)).rejects.toThrow(
      'profile failed'
    );
    expect(state.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-a\/[0-9a-f-]+\.jpg$/)]);
  });

  test('treats a missing provisioned profile as failure and removes the uploaded object', async () => {
    const state = avatarClient();
    state.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateAvatar(state.client, 'user-a', null, { type: 'image/jpeg', size: 100 } as File)).rejects.toThrow(
      'PROFILE_NOT_PROVISIONED'
    );
    expect(state.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-a\/[0-9a-f-]+\.jpg$/)]);
  });

  test('only recognizes current-user Supabase avatar objects for old-avatar cleanup', () => {
    const expected = 'https://project.supabase.co/storage/v1/object/public/avatars/user-a/new.png';
    expect(ownedAvatarPath(expected, 'user-a', expected)).toBe('user-a/new.png');
    expect(
      ownedAvatarPath('https://project.supabase.co/storage/v1/object/public/avatars/user-a.webp', 'user-a', expected)
    ).toBe('user-a.webp');
    expect(
      ownedAvatarPath(
        'https://project.supabase.co/storage/v1/object/public/avatars/user-b/photo.png',
        'user-a',
        expected
      )
    ).toBeNull();
    expect(ownedAvatarPath('https://cdn.example/avatar.png', 'user-a', expected)).toBeNull();
    expect(ownedAvatarPath('/assets/nobi-avatar.svg', 'user-a', expected)).toBeNull();
  });

  test('removes the previous avatar only after a successful profile update', async () => {
    const state = avatarClient();
    const previous = 'https://project.supabase.co/storage/v1/object/public/avatars/user-a/old.webp';
    await updateAvatar(state.client, 'user-a', previous, { type: 'image/webp', size: 100 } as File);
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.remove).toHaveBeenCalledWith(['user-a/old.webp']);
  });

  test('never removes fallback, external, or another user avatar after replacement', async () => {
    for (const previous of [
      '/assets/nobi-avatar.svg',
      'https://cdn.example/avatar.png',
      'https://project.supabase.co/storage/v1/object/public/avatars/user-b/photo.png'
    ]) {
      const state = avatarClient();
      await updateAvatar(state.client, 'user-a', previous, { type: 'image/png', size: 100 } as File);
      expect(state.remove).not.toHaveBeenCalled();
    }
  });

  test('adds a replaceable cache version without changing the owned object path', () => {
    const raw = 'https://project.supabase.co/storage/v1/object/public/avatars/user-a/photo.webp?download=1';
    const displayed = avatarDisplayUrl(raw, 1234);
    expect(displayed).toBe(
      'https://project.supabase.co/storage/v1/object/public/avatars/user-a/photo.webp?download=1&v=1234'
    );
    expect(ownedAvatarPath(displayed, 'user-a', raw)).toBe('user-a/photo.webp');
  });
});
