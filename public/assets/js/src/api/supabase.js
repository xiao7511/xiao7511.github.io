import { fetchRuntimeConfig } from './config.js';

let client = null;
let clientPromise = null;

export async function initializeSupabase(runtimeConfig) {
  if (client) return client;
  if (!clientPromise) {
    clientPromise = (async () => {
      const config = runtimeConfig || (await fetchRuntimeConfig());
      client = window.supabase.createClient(config.SUPABASE_URL, config.ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return client;
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export function getSupabaseClient() {
  if (!client) throw new Error('Supabase 客户端尚未初始化');
  return client;
}
