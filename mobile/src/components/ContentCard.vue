<script setup lang="ts">
import ContentImage from './ContentImage.vue';
import type { ContentItem } from '../types/content';

defineProps<{ item: ContentItem; year?: string; label?: string; likeCount?: number }>();
</script>

<template>
  <RouterLink :to="`/${item.category}/${item.id}`" class="content-card">
    <ContentImage :src="item.cover_url" :alt="`${item.title}封面`" />
    <div class="content-card__body">
      <h3>{{ item.title || '未命名作品' }}</h3>
      <div v-if="year || label || likeCount !== undefined" class="content-card__meta">
        <span v-if="year && year !== '--'">{{ year }}</span
        ><span class="content-card__chip">{{ label || 'NOBI 推荐' }}</span
        ><strong>♡ {{ likeCount || 0 }}</strong>
      </div>
      <p v-else>{{ item.theme_tags?.slice(0, 2).join(' · ') || item.subtitle || 'NOBI 推荐' }}</p>
    </div>
  </RouterLink>
</template>
