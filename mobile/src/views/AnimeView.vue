<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAnimeStore } from '../stores/anime';
import ContentCard from '../components/ContentCard.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import AppError from '../components/AppError.vue';
import AppEmpty from '../components/AppEmpty.vue';
const anime = useAnimeStore();
const search = ref('');
const tag = ref('');
const tags = computed(() => [...new Set(anime.items.flatMap((item) => item.theme_tags ?? []))].slice(0, 12));
const filtered = computed(() =>
  anime.items.filter((item) => {
    const needle = search.value.trim().toLowerCase();
    const matchesText =
      !needle ||
      `${item.title} ${item.subtitle ?? ''} ${(item.theme_tags ?? []).join(' ')}`.toLowerCase().includes(needle);
    return matchesText && (!tag.value || item.theme_tags?.includes(tag.value));
  })
);
onMounted(() => {
  if (!anime.items.length) void anime.load();
});
</script>
<template>
  <div class="page listing-page">
    <div class="page-heading">
      <span class="eyebrow">EXPLORE</span>
      <h1>动漫</h1>
      <p>来自 NOBI 生产内容 API</p>
    </div>
    <div class="filter-bar">
      <label
        ><span class="sr-only">搜索动漫</span
        ><input v-model="search" type="search" placeholder="搜索标题或标签" /></label
      ><select v-model="tag" aria-label="按标签筛选">
        <option value="">全部标签</option>
        <option v-for="item in tags" :key="item" :value="item">{{ item }}</option>
      </select>
    </div>
    <AppSkeleton v-if="anime.loading" />
    <AppError v-else-if="anime.error" :message="anime.error" @retry="anime.load" />
    <div v-else-if="filtered.length" class="card-grid">
      <ContentCard v-for="item in filtered" :key="item.id" :item="item" />
    </div>
    <AppEmpty v-else title="没有匹配的动漫" message="调整搜索词或标签后重试。" />
  </div>
</template>
