import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadPublicSupabaseConfig } from './config';

let pending: Promise<SupabaseClient> | undefined;

export function getSupabase(): Promise<SupabaseClient> {
  if (!pending) {
    pending = loadPublicSupabaseConfig()
      .then(({ url, key }) => createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      }))
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}
