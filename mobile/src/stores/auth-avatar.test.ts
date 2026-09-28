import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { useAuthStore } from './auth';

describe('shared profile avatar state', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('updates the shared profile immediately for every AppAvatar consumer', () => {
    const auth = useAuthStore();
    auth.user = { id: 'user-a', email: 'user@nobi.test' } as typeof auth.user;
    auth.profile = { id: 'user-a', nickname: 'NOBI', avatar_url: 'old' };
    auth.setProfileAvatar('https://project.supabase.co/avatar.webp?v=2');
    expect(auth.profile?.avatar_url).toBe('https://project.supabase.co/avatar.webp?v=2');
  });
});
