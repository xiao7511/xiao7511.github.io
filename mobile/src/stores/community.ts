import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Session } from '@supabase/supabase-js';
import {
  addPost,
  addReply,
  fetchCommunityPage,
  fetchCommunityPost,
  reportPost,
  setUserBlock,
  togglePostLike,
  type ReportReason
} from '../services/community';
import { runOptimisticLike, type LikeState } from '../services/optimistic-like';
import { getSupabase } from '../services/supabase';
import type { CommunityPost, CommunityReply, Profile } from '../types/community';

export const useCommunityStore = defineStore('community', () => {
  const posts = ref<CommunityPost[]>([]);
  const selected = ref<CommunityPost | null>(null);
  const replies = ref<CommunityReply[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const page = ref(1);
  const pageSize = 5;
  const total = ref(0);
  const pendingLikes = ref<Record<number, boolean>>({});
  let postLoadRequest = 0;
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

  async function load(targetPage = page.value): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchCommunityPage(targetPage, pageSize);
      posts.value = result.posts;
      total.value = result.total;
      page.value = targetPage;
    } catch {
      error.value = '社区动态加载失败，请检查网络后重试。';
    } finally {
      loading.value = false;
    }
  }

  async function loadPost(id: number): Promise<void> {
    const request = ++postLoadRequest;
    loading.value = true;
    error.value = null;
    selected.value = null;
    replies.value = [];
    try {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('INVALID_POST_ID');
      const result = await fetchCommunityPost(id);
      if (request !== postLoadRequest) return;
      selected.value = result.post;
      replies.value = result.replies;
    } catch {
      if (request !== postLoadRequest) return;
      selected.value = null;
      replies.value = [];
      error.value = '帖子加载失败或已不存在。';
    } finally {
      if (request === postLoadRequest) loading.value = false;
    }
  }

  function applyLike(id: number, state: LikeState): void {
    const item = posts.value.find((post) => post.id === id);
    if (item) Object.assign(item, state);
    if (selected.value?.id === id) Object.assign(selected.value, state);
  }

  async function toggleLike(id: number, session: Session): Promise<void> {
    if (pendingLikes.value[id]) return;
    const item = posts.value.find((post) => post.id === id) ?? (selected.value?.id === id ? selected.value : null);
    if (!item) return;
    pendingLikes.value[id] = true;
    try {
      const client = await getSupabase();
      await runOptimisticLike(
        { liked: item.liked, likeCount: item.likeCount },
        (state) => applyLike(id, state),
        async (remove) => {
          if (!session.access_token) throw new Error('UNAUTHORIZED');
          return togglePostLike(client, id, remove);
        }
      );
    } finally {
      pendingLikes.value[id] = false;
    }
  }

  async function reply(postId: number, content: string, session: Session, profile: Profile | null, imagePath: string | null = null): Promise<void> {
    await addReply(await getSupabase(), session, profile, postId, content, imagePath);
    if (selected.value?.id === postId) await loadPost(postId);
  }

  async function publish(
    input: { title: string; content: string; category: string },
    session: Session,
    profile: Profile | null
  ): Promise<void> {
    await addPost(await getSupabase(), session, profile, input);
    await load(1);
  }

  async function report(id: number, reason: ReportReason, details: string, session: Session): Promise<number> {
    if (!session.access_token) throw new Error('UNAUTHORIZED');
    return reportPost(await getSupabase(), id, reason, details);
  }

  async function blockUser(userId: string, session: Session): Promise<void> {
    if (!session.access_token || userId === session.user.id) throw new Error('INVALID_BLOCK_TARGET');
    await setUserBlock(await getSupabase(), userId, true);
    posts.value = posts.value.filter((post) => post.user_id !== userId);
    replies.value = replies.value.filter((reply) => reply.user_id !== userId);
    if (selected.value?.user_id === userId) selected.value = null;
  }

  return {
    posts,
    selected,
    replies,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages,
    pendingLikes,
    load,
    loadPost,
    toggleLike,
    reply,
    publish,
    report,
    blockUser
  };
});
