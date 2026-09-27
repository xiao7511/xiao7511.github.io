import type { Session, SupabaseClient } from '@supabase/supabase-js';

export function isUsableSession(session: Session | null, now = Date.now()): session is Session {
  return Boolean(
    session?.user?.id && session.access_token && session.expires_at && session.expires_at * 1000 > now + 30_000
  );
}

export async function restoreAuthSession(client: SupabaseClient): Promise<Session | null> {
  const result = await client.auth.getSession();
  if (result.error) throw result.error;
  if (!result.data.session) return null;
  if (isUsableSession(result.data.session)) return result.data.session;
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  return isUsableSession(refreshed.data.session) ? refreshed.data.session : null;
}

export function authErrorMessage(error: unknown): string {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return '邮箱或密码不正确';
  if (message.includes('email not confirmed')) return '请先完成邮箱验证';
  if (message.includes('already registered')) return '该邮箱已经注册';
  if (message.includes('password')) return '密码不符合安全要求';
  if (message.includes('network') || message.includes('fetch')) return '网络连接失败，请稍后重试';
  return '操作失败，请稍后重试';
}
