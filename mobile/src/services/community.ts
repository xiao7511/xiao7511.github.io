import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { CommunityPage, CommunityPost, CommunityReply, Profile } from '../types/community';

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'privacy' | 'other';

interface PostRow {
  id: number;
  user_id: string | null;
  created_at: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  title: string | null;
  category: string | null;
  parent_id: number | null;
  image_path: string | null;
}

interface LikeRow {
  post_id: number;
  user_id: string;
}

const postColumns = 'id,user_id,created_at,content,nickname,avatar_url,title,category,parent_id,image_path';

function replyImageUrl(client: SupabaseClient, path: string | null): string | null {
  return path ? client.storage.from('community').getPublicUrl(path).data.publicUrl || null : null;
}

function mapPost(row: PostRow, likes: LikeRow[], replies: PostRow[], userId?: string): CommunityPost {
  const postLikes = likes.filter((like) => like.post_id === row.id);
  return {
    ...row,
    likeCount: postLikes.length,
    replyCount: replies.filter((reply) => reply.parent_id === row.id).length,
    liked: Boolean(userId && postLikes.some((like) => like.user_id === userId))
  };
}

export async function fetchCommunityPage(page = 1, pageSize = 5, client?: SupabaseClient): Promise<CommunityPage> {
  const supabase = client ?? (await getSupabase());
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const [countResult, postsResult, sessionResult] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).is('parent_id', null),
    supabase
      .from('posts')
      .select(postColumns)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(start, end),
    supabase.auth.getSession()
  ]);
  if (countResult.error) throw countResult.error;
  if (postsResult.error) throw postsResult.error;
  const rows = (postsResult.data ?? []) as PostRow[];
  if (!rows.length) return { posts: [], total: countResult.count ?? 0 };
  const ids = rows.map((post) => post.id);
  const [repliesResult, likesResult] = await Promise.all([
    supabase.from('posts').select(postColumns).in('parent_id', ids).order('created_at', { ascending: true }),
    supabase.from('post_likes').select('post_id,user_id').in('post_id', ids)
  ]);
  if (repliesResult.error) throw repliesResult.error;
  if (likesResult.error) throw likesResult.error;
  const replies = (repliesResult.data ?? []) as PostRow[];
  const likes = (likesResult.data ?? []) as LikeRow[];
  const userId = sessionResult.data.session?.user.id;
  return { posts: rows.map((row) => mapPost(row, likes, replies, userId)), total: countResult.count ?? rows.length };
}

export async function fetchCommunityPost(
  id: number,
  client?: SupabaseClient
): Promise<{ post: CommunityPost; replies: CommunityReply[] }> {
  const supabase = client ?? (await getSupabase());
  const [postResult, repliesResult, likesResult, sessionResult] = await Promise.all([
    supabase.from('posts').select(postColumns).eq('id', id).is('parent_id', null).maybeSingle(),
    supabase.from('posts').select(postColumns).eq('parent_id', id).order('created_at', { ascending: true }),
    supabase.from('post_likes').select('post_id,user_id').eq('post_id', id),
    supabase.auth.getSession()
  ]);
  if (postResult.error) throw postResult.error;
  if (!postResult.data) throw new Error('POST_NOT_FOUND');
  if (repliesResult.error) throw repliesResult.error;
  if (likesResult.error) throw likesResult.error;
  const replies = (repliesResult.data ?? []) as PostRow[];
  const likes = (likesResult.data ?? []) as LikeRow[];
  return {
    post: mapPost(postResult.data as PostRow, likes, replies, sessionResult.data.session?.user.id),
    replies: replies.map((reply) => ({
      ...reply,
      parent_id: id,
      image_url: replyImageUrl(supabase, reply.image_path)
    }))
  };
}

export async function togglePostLike(
  client: SupabaseClient,
  postId: number,
  remove: boolean
): Promise<{ liked: boolean; likeCount: number }> {
  const result = await client.rpc('toggle_post_like', { p_post_id: postId, p_remove: remove });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || typeof row.liked !== 'boolean' || !Number.isFinite(Number(row.like_count)))
    throw new Error('INVALID_LIKE_RESPONSE');
  return { liked: row.liked, likeCount: Number(row.like_count) };
}

export async function addReply(
  client: SupabaseClient,
  session: Session,
  profile: Profile | null,
  postId: number,
  content: string,
  imagePath: string | null = null
): Promise<void> {
  const result = await client.from('posts').insert({
    content,
    user_id: session.user.id,
    nickname: profile?.nickname || session.user.email?.split('@')[0] || '社区用户',
    avatar_url: profile?.avatar_url || null,
    parent_id: postId,
    image_path: imagePath
  });
  if (result.error) throw result.error;
}

export async function addPost(
  client: SupabaseClient,
  session: Session,
  profile: Profile | null,
  input: { title: string; content: string; category: string }
): Promise<void> {
  const result = await client.from('posts').insert({
    title: input.title || null,
    content: input.content,
    category: input.category,
    user_id: session.user.id,
    nickname: profile?.nickname || session.user.email?.split('@')[0] || '社区用户',
    avatar_url: profile?.avatar_url || null,
    parent_id: null
  });
  if (result.error) throw result.error;
}

export async function reportPost(
  client: SupabaseClient,
  postId: number,
  reason: ReportReason,
  details: string
): Promise<number> {
  const result = await client.rpc('report_post', {
    p_post_id: postId,
    p_reason: reason,
    p_details: details.trim() || null
  });
  if (result.error) throw result.error;
  const id = Number(result.data);
  if (!Number.isInteger(id) || id <= 0) throw new Error('INVALID_REPORT_RESPONSE');
  return id;
}

export async function setUserBlock(client: SupabaseClient, userId: string, blocked: boolean): Promise<void> {
  const result = await client.rpc('set_user_block', { p_blocked_id: userId, p_blocked: blocked });
  if (result.error) throw result.error;
  if (result.data !== blocked) throw new Error('INVALID_BLOCK_RESPONSE');
}
