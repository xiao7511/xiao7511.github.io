import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadPublicSupabaseConfig } from './config';
import { createSessionStorage } from './storage';

let pending: Promise<SupabaseClient> | undefined;

export function getSupabase(): Promise<SupabaseClient> {
  if (!pending) {
    pending = loadPublicSupabaseConfig()
      .then(({ url, key }) =>
        createClient(url, key, {
          auth: {
            storage: createSessionStorage(),
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        })
      )
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}

export function resetSupabaseForTests(): void {
  pending = undefined;
}
