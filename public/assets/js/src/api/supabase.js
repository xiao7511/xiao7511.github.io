import { fetchRuntimeConfig } from './config.js';

let client = null;

export async function initializeSupabase(runtimeConfig) {
  if (client) return client;
  const config = runtimeConfig || (await fetchRuntimeConfig());
  client = window.supabase.createClient(config.SUPABASE_URL, config.ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return client;
}

export function getSupabaseClient() {
  if (!client) throw new Error('Supabase 客户端尚未初始化');
  return client;
}
