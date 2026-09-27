import { fetchJson } from './http';

const DEFAULT_API_ORIGIN = 'https://api.nobistudio.com';

export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_ORIGIN;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('API 必须使用 HTTPS');
  }
  return url.origin;
}

export function webOrigin(): string {
  const raw = import.meta.env.VITE_WEB_BASE_URL || 'https://www.nobistudio.com';
  const url = new URL(raw);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('分享 Web 地址必须是非本机 HTTPS 地址');
  }
  return url.origin;
}

export interface PublicSupabaseConfig {
  url: string;
  key: string;
}

function isPublicKey(key: string): boolean {
  if (!key || key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

export async function loadPublicSupabaseConfig(): Promise<PublicSupabaseConfig> {
  let url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  let key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !key) {
    const config = await fetchJson(`${apiOrigin()}/`);
    if (!config || typeof config !== 'object') throw new Error('认证配置格式无效');
    const fields = config as Record<string, unknown>;
    url = typeof fields.SUPABASE_URL === 'string' ? fields.SUPABASE_URL : '';
    key = typeof fields.ANON_KEY === 'string' ? fields.ANON_KEY : '';
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !isPublicKey(key)) {
    throw new Error('Supabase 公共配置无效');
  }
  return { url: parsed.origin, key };
}
