import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentItem } from '../types/content';
import {
  isValidSocialUrl,
  parseSocialSettings,
  serializeSocialSettings,
  type SocialSettings
} from './social-links';

export interface AdminUser {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface AdminReport {
  id: number;
  post_id: number;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter_id: string;
  post?: {
    content?: string | null;
    nickname?: string | null;
    user_id?: string | null;
    moderation_status?: string;
  } | null;
}

export async function fetchAdminStatus(client: SupabaseClient): Promise<boolean> {
  const result = await client.rpc('is_admin');
  if (result.error) throw result.error;
  return result.data === true;
}

export async function fetchAdminUsers(client: SupabaseClient): Promise<AdminUser[]> {
  const usersResult = await client
    .from('users')
    .select('id,email,is_admin,created_at')
    .order('created_at', { ascending: false });
  if (usersResult.error) throw usersResult.error;
  const users = (usersResult.data ?? []) as Array<Omit<AdminUser, 'nickname' | 'avatar_url'>>;
  if (!users.length) return [];
  const profilesResult = await client
    .from('profiles')
    .select('id,nickname,avatar_url')
    .in(
      'id',
      users.map((user) => user.id)
    );
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  return users.map((user) => ({
    ...user,
    is_admin: user.is_admin === true,
    nickname: profiles.get(user.id)?.nickname ?? null,
    avatar_url: profiles.get(user.id)?.avatar_url ?? null
  }));
}

export async function setAdminState(client: SupabaseClient, userId: string, enabled: boolean): Promise<void> {
  const result = await client.rpc('set_user_admin', { p_user_id: userId, p_is_admin: enabled });
  if (result.error) throw result.error;
}

export async function fetchPendingReports(client: SupabaseClient): Promise<AdminReport[]> {
  const result = await client
    .from('post_reports')
    .select(
      'id,post_id,reporter_id,reason,details,status,created_at,post:posts(content,nickname,user_id,moderation_status)'
    )
    .in('status', ['pending', 'reviewing'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (result.error) throw result.error;
  return (result.data ?? []) as unknown as AdminReport[];
}

export async function reviewReport(
  client: SupabaseClient,
  reportId: number,
  action: 'dismiss' | 'hide' | 'remove' | 'restore',
  note = ''
): Promise<void> {
  const result = await client.rpc('review_post_report', {
    p_report_id: reportId,
    p_action: action,
    p_note: note.trim() || null
  });
  if (result.error) throw result.error;
}

export async function fetchAdminBanners(client: SupabaseClient): Promise<ContentItem[]> {
  const result = await client.from('content_management').select('*').eq('category', 'banner').order('slot_index');
  if (result.error) throw result.error;
  return (result.data ?? []) as ContentItem[];
}

export async function updateAdminBanner(
  client: SupabaseClient,
  id: string,
  changes: Pick<ContentItem, 'title' | 'subtitle' | 'slot_index'> & { linked_content_id?: string | null }
): Promise<void> {
  const result = await client.from('content_management').update(changes).eq('id', id).eq('category', 'banner');
  if (result.error) throw result.error;
}

export async function fetchAdminLinkableContent(client: SupabaseClient): Promise<ContentItem[]> {
  const result = await client
    .from('content_management')
    .select('*')
    .in('category', ['anime', 'manga'])
    .order('category')
    .order('slot_index');
  if (result.error) throw result.error;
  return (result.data ?? []) as ContentItem[];
}

export async function fetchAdminStats(client: SupabaseClient): Promise<Record<string, unknown>> {
  const result = await client.rpc('get_admin_dashboard_stats');
  if (result.error) throw result.error;
  return (typeof result.data === 'string' ? JSON.parse(result.data) : result.data) as Record<string, unknown>;
}

export type HomeContentCategory = 'anime' | 'manga';

export async function fetchAdminHomeContent(
  client: SupabaseClient,
  category: HomeContentCategory
): Promise<ContentItem[]> {
  const result = await client.from('content_management').select('*').eq('category', category).order('slot_index');
  if (result.error) throw result.error;
  return ((result.data ?? []) as ContentItem[]).sort((a, b) => a.slot_index - b.slot_index);
}

export async function saveAdminHomeContent(
  client: SupabaseClient,
  category: HomeContentCategory,
  items: ContentItem[]
): Promise<void> {
  if (items.filter((item) => item.is_active !== false).length > 6) throw new Error('ACTIVE_CONTENT_LIMIT');
  const result = await client.rpc('save_home_content_order', {
    p_category: category,
    p_items: items.map((item, index) => ({ id: item.id, slot_index: index, is_active: item.is_active !== false }))
  });
  if (result.error) throw result.error;
}

export async function deleteAdminHomeContent(
  client: SupabaseClient,
  category: HomeContentCategory,
  id: string
): Promise<void> {
  const result = await client.from('content_management').delete().eq('id', id).eq('category', category);
  if (result.error) throw result.error;
}

export async function fetchAdminSocialLinks(client: SupabaseClient): Promise<SocialSettings> {
  const result = await client.from('site_config').select('url').eq('section', 'social_links').maybeSingle();
  if (result.error) throw result.error;
  return parseSocialSettings(result.data?.url);
}

export async function saveAdminSocialLinks(client: SupabaseClient, settings: SocialSettings): Promise<void> {
  if (settings.some((item) => !isValidSocialUrl(item.url, item.key))) throw new Error('INVALID_SOCIAL_URL');
  const result = await client.from('site_config').upsert(
    {
      section: 'social_links',
      url: serializeSocialSettings(settings),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'section' }
  );
  if (result.error) throw result.error;
}
