import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { isContentItem, type ContentItem } from '../types/content';
import type { CommunityPost, Profile } from '../types/community';

export interface SearchResults {
  content: ContentItem[];
  posts: CommunityPost[];
  users: Profile[];
}

export async function searchAll(query: string, client?: SupabaseClient): Promise<SearchResults> {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  if (needle.length < 2) return { content: [], posts: [], users: [] };
  const supabase = client ?? (await getSupabase());
  const [contentResult, postsResult, profilesResult] = await Promise.all([
    supabase.from('content_management').select('*').in('category', ['anime', 'manga']).order('slot_index').limit(100),
    supabase
      .from('posts')
      .select('id,user_id,created_at,content,nickname,avatar_url,title,category,parent_id,image_path')
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('id,nickname,avatar_url,created_at').limit(50)
  ]);
  if (contentResult.error) throw contentResult.error;
  if (postsResult.error) throw postsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const includes = (...values: unknown[]): boolean =>
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .some((value) => String(value ?? '').toLocaleLowerCase('zh-CN').includes(needle));
  return {
    content: (contentResult.data ?? [])
      .filter(isContentItem)
      .filter((item) => includes(item.title, item.subtitle, item.theme_tags)),
    posts: (postsResult.data ?? [])
      .filter((post) => includes(post.title, post.content, post.nickname))
      .map((post) => ({ ...post, likeCount: 0, replyCount: 0, liked: false })) as CommunityPost[],
    users: (profilesResult.data ?? []).filter((profile) => includes(profile.nickname)) as Profile[]
  };
}
