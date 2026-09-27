import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../services/supabase';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const ready = ref(false);
  const error = ref<string | null>(null);

  async function restoreSession(): Promise<void> {
    try {
      const client = await getSupabase();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      let session = data.session;
      if (!session) { user.value = null; return; }
      if (!session.expires_at || session.expires_at * 1000 <= Date.now() + 30_000) {
        const refresh = await client.auth.refreshSession();
        session = refresh.data.session;
        if (refresh.error || !session) { user.value = null; return; }
      }
      const verified = await client.auth.getUser(session.access_token);
      if (verified.error || !verified.data.user) { user.value = null; return; }
      user.value = verified.data.user;
      error.value = null;
    } catch {
      user.value = null;
      error.value = '登录状态暂时无法验证';
    } finally {
      ready.value = true;
    }
  }

  return { user, ready, error, restoreSession };
});
