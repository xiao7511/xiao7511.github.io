<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ContentImage from './ContentImage.vue';
import type { ContentItem } from '../types/content';
import { contentCoverLikeTarget } from '../services/image-likes';
import { useImageLikesStore } from '../stores/image-likes';
import { useToastStore } from '../stores/toast';

const props = defineProps<{ item: ContentItem; year?: string; label?: string; likeCount?: number }>();
const likes = useImageLikesStore();
const toast = useToastStore();
const route = useRoute();
const router = useRouter();
const target = computed(() => contentCoverLikeTarget(props.item));
const summary = computed(() => {
  const key = target.value?.imageKey;
  return (key && likes.summaries[key]) || { count: props.likeCount ?? 0, liked: false };
});

async function toggleLike(): Promise<void> {
  try {
    await likes.toggle(props.item);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      toast.show('登录后即可点赞', 'info');
      await router.push({ name: 'login', query: { redirect: route.fullPath } });
      return;
    }
    toast.show('点赞失败，请稍后重试', 'error');
  }
}
</script>

<template>
  <article class="content-card">
    <RouterLink :to="`/${item.category}/${item.id}`" class="content-card__link">
      <ContentImage :src="item.cover_url" :alt="`${item.title}封面`" />
    </RouterLink>
    <div class="content-card__body">
      <h3>
        <RouterLink :to="`/${item.category}/${item.id}`">{{ item.title || '未命名作品' }}</RouterLink>
      </h3>
      <div v-if="year || label || likeCount !== undefined" class="content-card__meta">
        <span v-if="year && year !== '--'">{{ year }}</span
        ><span class="content-card__chip">{{ label || 'NOBI 推荐' }}</span
        ><button
          v-if="target"
          type="button"
          class="content-like-button"
          :class="{ 'is-liked': summary.liked }"
          :aria-pressed="summary.liked"
          :aria-label="`${summary.liked ? '取消点赞' : '点赞'} ${item.title}`"
          :disabled="likes.isPending(item)"
          @click="toggleLike"
        >
          <span aria-hidden="true">{{ summary.liked ? '♥' : '♡' }}</span> {{ summary.count }}
        </button>
      </div>
      <p v-else>{{ item.theme_tags?.slice(0, 2).join(' · ') || item.subtitle || 'NOBI 推荐' }}</p>
    </div>
  </article>
</template>
