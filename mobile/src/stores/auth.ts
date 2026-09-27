import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { authErrorMessage, restoreAuthSession } from '../services/auth';
import { getSupabase } from '../services/supabase';
import type { Profile } from '../types/community';

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false);
  const loading = ref(false);
  const session = ref<Session | null>(null);
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const error = ref<string | null>(null);
  let initializePromise: Promise<void> | null = null;
  let listening = false;

  async function loadProfile(): Promise<void> {
    if (!user.value) {
      profile.value = null;
      return;
    }
    const client = await getSupabase();
    const result = await client
      .from('profiles')
      .select('id,nickname,avatar_url,created_at')
      .eq('id', user.value.id)
      .maybeSingle();
    if (result.error) throw result.error;
    profile.value = result.data as Profile | null;
  }

  async function applySession(next: Session | null, loadUserProfile = true): Promise<void> {
    session.value = next;
    user.value = next?.user ?? null;
    if (!next) profile.value = null;
    else if (loadUserProfile) await loadProfile();
  }

  async function handleAuthChange(_event: AuthChangeEvent, next: Session | null): Promise<void> {
    try {
      await applySession(next);
    } catch {
      profile.value = null;
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
    error,
    initialize,
    signIn,
    signUp,
    signOut,
    refreshSession,
    loadProfile,
    resume
  };
});
