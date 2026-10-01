import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { authErrorMessage, restoreAuthSession } from '../services/auth';
import { fetchAdminStatus } from '../services/admin';
import { getSupabase } from '../services/supabase';
import type { Profile } from '../types/community';

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false);
  const loading = ref(false);
  const session = ref<Session | null>(null);
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const profileStatus = ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const isAdmin = ref(false);
  const error = ref<string | null>(null);
  let initializePromise: Promise<void> | null = null;
  let listening = false;
  let sessionVersion = 0;
  let profileRequestVersion = 0;

  async function loadProfile(expectedSessionVersion = sessionVersion, expectedUserId = user.value?.id): Promise<void> {
    const requestVersion = ++profileRequestVersion;
    if (!expectedUserId) {
      if (expectedSessionVersion === sessionVersion) {
        profile.value = null;
        profileStatus.value = 'idle';
      }
      return;
    }
    if (expectedSessionVersion === sessionVersion && expectedUserId === user.value?.id) profileStatus.value = 'loading';
    try {
      const client = await getSupabase();
      const result = await client
        .from('profiles')
        .select('id,nickname,avatar_url,created_at')
        .eq('id', expectedUserId)
        .maybeSingle();
      if (expectedSessionVersion !== sessionVersion || expectedUserId !== user.value?.id || requestVersion !== profileRequestVersion) {
        return;
      }
      if (result.error) throw result.error;
      profile.value = result.data as Profile | null;
      profileStatus.value = result.data ? 'ready' : 'missing';
    } catch (cause) {
      if (expectedSessionVersion !== sessionVersion || expectedUserId !== user.value?.id || requestVersion !== profileRequestVersion) {
        return;
      }
      profile.value = null;
      profileStatus.value = 'error';
      throw cause;
    }
  }

  function setProfileAvatar(avatarUrl: string, expectedUserId = user.value?.id): void {
    if (!expectedUserId || user.value?.id !== expectedUserId || profile.value?.id !== expectedUserId) return;
    profile.value = {
      id: expectedUserId,
      nickname: profile.value?.nickname ?? null,
      created_at: profile.value?.created_at,
      avatar_url: avatarUrl
    };
  }

  async function applySession(next: Session | null, loadUserProfile = true): Promise<void> {
    const version = ++sessionVersion;
    profileRequestVersion++;
    const nextUserId = next?.user?.id ?? null;
    if (user.value?.id !== nextUserId || !nextUserId || !loadUserProfile) profile.value = null;
    profileStatus.value = nextUserId && loadUserProfile ? 'loading' : 'idle';
    isAdmin.value = false;
    session.value = next;
    user.value = next?.user ?? null;
    if (!next) {
      profile.value = null;
    } else if (loadUserProfile) {
      const client = await getSupabase();
      if (version !== sessionVersion || user.value?.id !== nextUserId) return;
      const [profileResult, adminResult] = await Promise.allSettled([
        loadProfile(version, nextUserId),
        fetchAdminStatus(client)
      ]);
      if (version !== sessionVersion || user.value?.id !== nextUserId) return;
      if (profileResult.status === 'rejected') profileStatus.value = 'error';
      isAdmin.value = adminResult.status === 'fulfilled' ? adminResult.value : false;
    }
  }

  async function handleAuthChange(_event: AuthChangeEvent, next: Session | null): Promise<void> {
    try {
      await applySession(next);
    } catch {
      // applySession clears user-specific state before loading; a stale failure
      // must not clear a profile belonging to a newer session.
    }
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return;
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      loading.value = true;
      try {
        const client = await getSupabase();
        const restored = await restoreAuthSession(client);
        await applySession(restored);
        if (!listening) {
          client.auth.onAuthStateChange((event, next) => {
            globalThis.setTimeout(() => void handleAuthChange(event, next), 0);
          });
          listening = true;
        }
        error.value = null;
      } catch (cause) {
        await applySession(null, false);
        error.value = authErrorMessage(cause);
      } finally {
        loading.value = false;
        initialized.value = true;
        initializePromise = null;
      }
    })();
    return initializePromise;
  }

  async function signIn(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = await getSupabase();
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await applySession(result.data.session);
    } catch (cause) {
      error.value = authErrorMessage(cause);
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }> {
    loading.value = true;
    error.value = null;
    try {
      const client = await getSupabase();
      const result = await client.auth.signUp({ email, password });
      if (result.error) throw result.error;
      await applySession(result.data.session);
      return { confirmationRequired: Boolean(result.data.user && !result.data.session) };
    } catch (cause) {
      error.value = authErrorMessage(cause);
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function signOut(): Promise<void> {
    loading.value = true;
    try {
      const client = await getSupabase();
      const result = await client.auth.signOut();
      if (result.error) throw result.error;
      await applySession(null, false);
      error.value = null;
    } catch (cause) {
      error.value = authErrorMessage(cause);
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function refreshSession(): Promise<void> {
    if (!session.value) return;
    const client = await getSupabase();
    const result = await client.auth.refreshSession();
    if (result.error) throw result.error;
    await applySession(result.data.session);
  }

  async function resume(): Promise<void> {
    if (!initialized.value) return initialize();
    if (!session.value) return;
    try {
      await refreshSession();
    } catch {
      await applySession(null, false);
    }
  }

  return {
    initialized,
    loading,
    session,
    user,
    profile,
    profileStatus,
    isAdmin,
    error,
    initialize,
    signIn,
    signUp,
    signOut,
    refreshSession,
    loadProfile,
    setProfileAvatar,
    resume
  };
});
