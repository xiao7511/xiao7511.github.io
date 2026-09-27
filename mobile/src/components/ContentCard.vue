<script setup lang="ts">
import ContentImage from './ContentImage.vue';
import type { ContentItem } from '../types/content';

defineProps<{ item: ContentItem }>();
</script>

<template>
  <article class="content-card">
    <ContentImage :src="item.cover_url" :alt="`${item.title}封面`" />
    <div class="content-card__body">
      <h3>{{ item.title }}</h3>
      <p>{{ item.year || item.subtitle || 'NOBI 推荐' }}</p>
    </div>
  </article>
</template>
