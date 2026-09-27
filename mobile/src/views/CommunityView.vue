<script setup lang="ts">
import { onMounted } from 'vue';
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
    <div class="page-heading page-heading--action">
      <div>
        <span class="eyebrow">COMMUNITY</span>
        <h1>社区</h1>
        <p>来自现有 NOBI 社区数据</p>
      </div>
      <RouterLink to="/community/new" class="primary-button">发布</RouterLink>
    </div>
    <AppSkeleton v-if="community.loading" variant="post" :count="3" /><AppError
      v-else-if="community.error"
      :message="community.error"
      @retry="community.load()"
    />
    <div v-else-if="community.posts.length" class="feed-list">
      <CommunityCard
        v-for="post in community.posts"
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
