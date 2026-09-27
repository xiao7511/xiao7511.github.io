<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCommunityStore } from '../stores/community';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { communityWebUrl } from '../services/urls';
import { shareContent } from '../services/native';
import type { CommunityPost } from '../types/community';
import CommunityCard from '../components/CommunityCard.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import AppError from '../components/AppError.vue';
import AppEmpty from '../components/AppEmpty.vue';
const community = useCommunityStore();
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
const query = ref('');
interface FocusableInput {
  focus(): void;
}
const searchInput = ref<FocusableInput | null>(null);
const category = ref('热门');
const filteredPosts = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const rows = community.posts.filter((post) => {
    const matchesText = !needle || `${post.title ?? ''} ${post.content} ${post.nickname ?? ''}`.toLowerCase().includes(needle);
    const matchesCategory = ['热门', '最新', '讨论'].includes(category.value) || post.category?.includes(category.value);
    return matchesText && matchesCategory;
  });
  return category.value === '热门' ? [...rows].sort((a, b) => b.likeCount - a.likeCount) : rows;
});
onMounted(() => {
  if (!community.posts.length) void community.load(1);
});
async function like(post: CommunityPost): Promise<void> {
  if (!auth.session) {
    await router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }
  try {
    await community.toggleLike(post.id, auth.session);
  } catch {
    toast.show('点赞失败，状态已恢复', 'error');
  }
}
async function share(post: CommunityPost): Promise<void> {
  try {
    await shareContent(post.title || 'NOBI 社区动态', communityWebUrl(), post.content.slice(0, 100));
    toast.show('分享内容已准备好', 'success');
  } catch {
    toast.show('分享失败', 'error');
  }
}
</script>
<template>
  <div class="page listing-page">
    <div class="page-heading page-heading--action community-heading">
      <h1>社区</h1>
      <button type="button" class="header-action" aria-label="搜索社区" @click="searchInput?.focus()">⌕</button>
      <RouterLink to="/community/new" class="primary-button">发布</RouterLink>
    </div>
    <div class="community-toolbar">
      <label><span class="sr-only">搜索社区</span><input ref="searchInput" v-model="query" type="search" placeholder="搜索帖子或用户" /></label>
      <div class="community-categories"><button v-for="item in ['热门','最新','动漫','漫画','讨论']" :key="item" type="button" :class="{active: category === item}" @click="category = item">{{ item }}</button></div>
    </div>
    <AppSkeleton v-if="community.loading" variant="post" :count="3" /><AppError
      v-else-if="community.error"
      :message="community.error"
      @retry="community.load()"
    />
    <div v-else-if="filteredPosts.length" class="feed-list">
      <CommunityCard
        v-for="post in filteredPosts"
        :key="post.id"
        :post="post"
        :pending="community.pendingLikes[post.id]"
        @like="like"
        @share="share"
      />
      <nav v-if="community.totalPages > 1" class="pagination" aria-label="社区分页">
        <button type="button" :disabled="community.page <= 1" @click="community.load(community.page - 1)">上一页</button
        ><span>{{ community.page }} / {{ community.totalPages }}</span
        ><button
          type="button"
          :disabled="community.page >= community.totalPages"
          @click="community.load(community.page + 1)"
        >
          下一页
        </button>
      </nav>
    </div>
    <AppEmpty v-else title="还没有社区动态" message="登录后发布第一条内容吧。" />
  </div>
</template>
