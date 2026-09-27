<script setup lang="ts">
import ContentImage from './ContentImage.vue';
import type { ContentItem } from '../types/content';

defineProps<{ item: ContentItem }>();
</script>

<template>
  <RouterLink :to="`/${item.category}/${item.id}`" class="content-card">
    <ContentImage :src="item.cover_url" :alt="`${item.title}封面`" />
    <div class="content-card__body">
      <h3>{{ item.title || '未命名作品' }}</h3>
      <p>{{ item.theme_tags?.slice(0, 2).join(' · ') || item.subtitle || 'NOBI 推荐' }}</p>
    </div>
  </RouterLink>
</template>
