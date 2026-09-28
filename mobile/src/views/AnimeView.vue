<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAnimeStore } from '../stores/anime';
import ContentCard from '../components/ContentCard.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import AppError from '../components/AppError.vue';
import AppEmpty from '../components/AppEmpty.vue';
import { contentYear } from '../services/home';
import { useImageLikesStore } from '../stores/image-likes';
const anime = useAnimeStore();
const imageLikes = useImageLikesStore();
const search = ref('');
const tag = ref('');
const state = ref('all');
const year = ref('');
const region = ref('');
const sort = ref('slot');
const tags = computed(() => [...new Set(anime.items.flatMap((item) => item.theme_tags ?? []))].slice(0, 12));
const years = computed(() =>
  [...new Set(anime.items.map(contentYear).filter((value) => value !== '--'))].sort().reverse()
);
const regions = computed(() => [...new Set(anime.items.map((item) => item.region).filter(Boolean))] as string[]);
const filtered = computed(() => {
  const rows = anime.items.filter((item) => {
    const needle = search.value.trim().toLowerCase();
    const matchesText =
      !needle ||
      `${item.title} ${item.subtitle ?? ''} ${(item.theme_tags ?? []).join(' ')}`.toLowerCase().includes(needle);
    const text = `${item.status ?? ''} ${(item.theme_tags ?? []).join(' ')}`;
    const matchesState = state.value === 'all' || (state.value === 'hot' ? true : text.includes(state.value));
    return (
      matchesText &&
      matchesState &&
      (!tag.value || item.theme_tags?.includes(tag.value)) &&
      (!year.value || contentYear(item) === year.value) &&
      (!region.value || item.region === region.value)
    );
  });
  if (state.value === 'hot') return [...rows].sort((a, b) => imageLikes.get(b).count - imageLikes.get(a).count);
  return sort.value === 'year' ? [...rows].sort((a, b) => contentYear(b).localeCompare(contentYear(a))) : rows;
});
onMounted(async () => {
  if (!anime.items.length) await anime.load();
  await imageLikes.load(anime.items).catch(() => undefined);
});
</script>
<template>
  <div class="page listing-page">
    <div class="page-heading">
      <h1>动漫库</h1>
    </div>
    <div class="library-tabs" aria-label="动漫状态筛选">
      <button
        v-for="option in [
          { v: 'all', l: '全部' },
          { v: 'hot', l: '热门' },
          { v: '连载中', l: '连载中' },
          { v: '完结', l: '完结' }
        ]"
        :key="option.v"
        type="button"
        :class="{ active: state === option.v }"
        @click="state = option.v"
      >
        {{ option.l }}
      </button>
    </div>
    <div class="filter-bar library-filter-bar">
      <label
        ><span class="sr-only">搜索动漫</span
        ><input v-model="search" type="search" placeholder="搜索标题或标签" /></label
      ><select v-model="tag" aria-label="按类型筛选">
        <option value="">全部标签</option>
        <option v-for="item in tags" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="year" aria-label="按年份筛选">
        <option value="">年份</option>
        <option v-for="value in years" :key="value">{{ value }}</option>
      </select>
      <select v-model="region" aria-label="按地区筛选">
        <option value="">地区</option>
        <option v-for="value in regions" :key="value">{{ value }}</option>
      </select>
      <select v-model="sort" aria-label="排序">
        <option value="slot">默认排序</option>
        <option value="year">年份</option>
      </select>
    </div>
    <AppSkeleton v-if="anime.loading" />
    <AppError v-else-if="anime.error" :message="anime.error" @retry="anime.load" />
    <div v-else-if="filtered.length" class="card-grid library-grid">
      <ContentCard
        v-for="item in filtered"
        :key="item.id"
        :item="item"
        :year="contentYear(item)"
        :like-count="imageLikes.get(item).count"
      />
    </div>
    <AppEmpty v-else title="没有匹配的动漫" message="调整搜索词或标签后重试。" />
  </div>
</template>
