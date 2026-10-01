import { readFile } from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  ownedAvatarPath,
  updateAvatar,
  validateAvatar
} from '../public/assets/js/src/auth/avatar.js';
import { updateProvisionedNickname, waitForProvisionedProfile } from '../public/assets/js/src/auth/profile.js';
import { completeRegistrationProfile, registerUser } from '../public/assets/js/src/auth/registration.js';

const mainUrl = new URL('../public/assets/js/main.js', import.meta.url);
const profileUrl = new URL('../public/assets/js/src/auth/profile.js', import.meta.url);
const registrationUrl = new URL('../public/assets/js/src/auth/registration.js', import.meta.url);
const mobileAuthUrl = new URL('../mobile/src/stores/auth.ts', import.meta.url);
const siteUrl = new URL('../public/assets/js/src/site-v2.js', import.meta.url);

async function source(url) {
  return (await readFile(url, 'utf8')).replace(/\r\n?/g, '\n');
}

function profileClient({ reads = [], updates = [] } = {}) {
  const readQueue = [...reads];
  const updateQueue = [...updates];
  const update = vi.fn((payload) => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(updateQueue.shift() || { data: { id: 'user-1' }, error: null })
      }))
    }))
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(readQueue.shift() || { data: null, error: null })
      }))
    })),
    update
  }));
  return { client: { from }, from, update };
}

function avatarClient({ profileResult = { data: { id: 'user-1' }, error: null }, uploadError = null } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const publicUrl = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/new.png';
  const bucket = { upload, remove, getPublicUrl: vi.fn(() => ({ data: { publicUrl } })) };
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) }))
  }));
  const client = {
    storage: { from: vi.fn(() => bucket) },
    from: vi.fn(() => ({ update }))
  };
  return { client, upload, remove, update, publicUrl };
}

describe('Web registration profile provisioning', () => {
  test('successful signUp uses the database-provisioned profile and never inserts a client-side fallback', async () => {
    const state = profileClient({ reads: [{ data: { id: 'user-1', avatar_url: null }, error: null }] });
    state.client.auth = {
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } },
        error: null
      })
    };
    const result = await registerUser(state.client, {
      email: 'user@example.test',
      password: 'password',
      redirectTo: 'https://example.test/index.html',
      nickname: 'NOBI'
    });

    expect(result.completion.status).toBe('complete');
    expect(state.client.auth.signUp).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'password',
      options: { redirectTo: 'https://example.test/index.html' }
    });
    expect(state.update).toHaveBeenCalledWith({ nickname: 'NOBI' });
    const activeSources = `${await source(mainUrl)}\n${await source(profileUrl)}\n${await source(registrationUrl)}`;
    expect(activeSources).not.toMatch(/\.from\(['"]profiles['"]\)\s*\.insert/);
  });

  test('an Auth signUp failure remains an account-creation failure', async () => {
    const authError = new Error('signup failed');
    const client = {
      auth: { signUp: vi.fn().mockResolvedValue({ data: null, error: authError }) },
      from: vi.fn()
    };
    await expect(
      registerUser(client, { email: 'user@example.test', password: 'password', redirectTo: 'https://example.test' })
    ).rejects.toBe(authError);
    expect(authError.accountCreated).toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });

  test('waits a bounded number of times for trigger provisioning', async () => {
    const state = profileClient({
      reads: [
        { data: null, error: null },
        { data: { id: 'user-1', nickname: null, avatar_url: null }, error: null }
      ]
    });
    const sleep = vi.fn();
    await expect(
      waitForProvisionedProfile(state.client, 'user-1', { attempts: 3, delayMs: 1, sleep })
    ).resolves.toMatchObject({
      id: 'user-1'
    });
    expect(state.from).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  test('missing provisioning reports PROFILE_NOT_PROVISIONED without creating a row', async () => {
    const state = profileClient({
      reads: [
        { data: null, error: null },
        { data: null, error: null }
      ]
    });
    await expect(
      completeRegistrationProfile(state.client, {
        user: { id: 'user-1' },
        session: { user: { id: 'user-1' } },
        profileWaitOptions: { attempts: 2, delayMs: 0, sleep: vi.fn() }
      })
    ).rejects.toMatchObject({ code: 'PROFILE_NOT_PROVISIONED' });
    expect(state.update).not.toHaveBeenCalled();
  });

  test('nickname completion updates only nickname', async () => {
    const state = profileClient();
    await updateProvisionedNickname(state.client, 'user-1', 'NOBI');
    expect(state.update).toHaveBeenCalledWith({ nickname: 'NOBI' });
    expect(state.update).not.toHaveBeenCalledWith(expect.objectContaining({ avatar_url: expect.anything() }));
  });

  test('nickname persistence failure is identified after account creation', async () => {
    const state = profileClient({
      reads: [{ data: { id: 'user-1', avatar_url: null }, error: null }],
      updates: [{ data: null, error: new Error('nickname failed') }]
    });
    await expect(
      completeRegistrationProfile(state.client, {
        user: { id: 'user-1' },
        session: { user: { id: 'user-1' } },
        nickname: 'NOBI'
      })
    ).rejects.toMatchObject({ code: 'NICKNAME_UPDATE_FAILED', accountCreated: true });
  });

  test('registration without an avatar succeeds without persisting a decorative fallback', async () => {
    const state = profileClient({ reads: [{ data: { id: 'user-1', avatar_url: null }, error: null }] });
    const result = await completeRegistrationProfile(state.client, {
      user: { id: 'user-1' },
      session: { user: { id: 'user-1' } },
      nickname: ''
    });
    expect(result).toMatchObject({ status: 'complete', avatarUrl: null });
    expect(state.update).not.toHaveBeenCalled();
  });

  test('a signup without an authenticated session defers all profile and avatar writes', async () => {
    const state = profileClient();
    const result = await completeRegistrationProfile(state.client, {
      user: { id: 'user-1' },
      session: null,
      nickname: 'NOBI',
      avatarFile: { type: 'image/png', size: 10 }
    });
    expect(result.status).toBe('confirmation_required');
    expect(state.from).not.toHaveBeenCalled();
  });
});

describe('Web canonical avatar behavior', () => {
  test('accepts JPEG, PNG and WebP through 5MB and rejects invalid files', () => {
    expect(validateAvatar({ type: 'image/jpeg', size: 1 })).toBe('jpg');
    expect(validateAvatar({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBe('png');
    expect(validateAvatar({ type: 'image/webp', size: 1 })).toBe('webp');
    expect(() => validateAvatar({ type: 'video/mp4', size: 1 })).toThrow('INVALID_AVATAR_TYPE');
    expect(() => validateAvatar({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toThrow('INVALID_AVATAR_SIZE');
  });

  test('uploads only to the current user UUID path and updates only avatar_url', async () => {
    const state = avatarClient();
    const file = { type: 'image/png', size: 100 };
    await expect(updateAvatar(state.client, 'user-1', null, file)).resolves.toBe(state.publicUrl);
    expect(state.upload.mock.calls[0][0]).toMatch(/^user-1\/[0-9a-f-]+\.png$/);
    expect(state.upload).toHaveBeenCalledWith(expect.any(String), file, expect.objectContaining({ upsert: false }));
    expect(state.update).toHaveBeenCalledWith({ avatar_url: state.publicUrl });
  });

  test('cleans a newly uploaded object when avatar_url persistence fails', async () => {
    const state = avatarClient({ profileResult: { data: null, error: new Error('profile failed') } });
    await expect(updateAvatar(state.client, 'user-1', null, { type: 'image/png', size: 100 })).rejects.toThrow(
      'profile failed'
    );
    expect(state.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-1\/[0-9a-f-]+\.png$/)]);
  });

  test('cleans an old avatar only after success and only when ownership is proven', async () => {
    const state = avatarClient();
    const previous = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/old.webp';
    await updateAvatar(state.client, 'user-1', previous, { type: 'image/webp', size: 100 });
    expect(state.remove).toHaveBeenCalledWith(['user-1/old.webp']);
    expect(ownedAvatarPath('https://cdn.example/avatar.png', 'user-1', state.publicUrl)).toBeNull();
    expect(
      ownedAvatarPath(
        'https://project.supabase.co/storage/v1/object/public/avatars/user-2/photo.png',
        'user-1',
        state.publicUrl
      )
    ).toBeNull();
  });

  test('reports avatar failure after account creation as a recoverable deferred step', async () => {
    const state = profileClient({ reads: [{ data: { id: 'user-1', avatar_url: null }, error: null }] });
    state.client.storage = {
      from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: new Error('upload failed') }) }))
    };
    const result = await completeRegistrationProfile(state.client, {
      user: { id: 'user-1' },
      session: { user: { id: 'user-1' } },
      avatarFile: { type: 'image/png', size: 100 }
    });
    expect(result).toMatchObject({ status: 'avatar_deferred', avatarUrl: null });
    expect(result.error).toEqual(expect.objectContaining({ message: 'upload failed' }));
  });
});

describe('Web/Mobile profile model consistency', () => {
  test('active Web profile paths use avatar_url and no legacy profile columns', async () => {
    const activeSources = `${await source(mainUrl)}\n${await source(profileUrl)}\n${await source(registrationUrl)}`;
    expect(activeSources).toContain('avatar_url');
    expect(activeSources).not.toMatch(/profile\?\.avatar\b|profiles\.avatar\b/);
    expect(activeSources).not.toMatch(/profiles\.is_admin\b/);
  });

  test('Mobile registration does not compete with trigger provisioning', async () => {
    const mobileAuth = await source(mobileAuthUrl);
    expect(mobileAuth).toContain('client.auth.signUp');
    expect(mobileAuth).not.toMatch(/\.from\(['"]profiles['"]\)\s*\.insert/);
  });

  test('the Web retains its local default avatar fallback when avatar_url is null', async () => {
    const site = await source(siteUrl);
    expect(site).toContain("const DEFAULT_AVATAR = 'images/nobi-avatar.svg'");
    expect(site).toContain('setImageSource(image, profile?.avatar_url, DEFAULT_AVATAR)');
  });

  test('Web account profile responses are ignored after a newer account sync', async () => {
    const [site, main] = await Promise.all([source(siteUrl), source(mainUrl)]);
    expect(site).toContain('let accountSyncGeneration = 0');
    expect(site).toContain('generation === accountSyncGeneration && currentUser?.id === user.id');
    expect(main).toContain('let activeProfileUserId = null');
    expect(main).toContain('activeProfileUserId !== user.id');
    expect(main).toContain("alert('登录失败，请检查邮箱和密码后重试。')");
    expect(main).toContain("alert('注册失败，请检查邮箱和密码后重试。')");
    expect(main).toContain("'头像保存失败，请稍后重试。'");
  });
});
