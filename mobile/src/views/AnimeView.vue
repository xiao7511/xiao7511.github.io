<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAnimeStore } from '../stores/anime';
import ContentCard from '../components/ContentCard.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import AppError from '../components/AppError.vue';
import AppEmpty from '../components/AppEmpty.vue';
import { contentLabel, contentYear } from '../services/home';
import { filterLibraryItems, libraryRegions, libraryTags, libraryYears } from '../services/library';
import { useImageLikesStore } from '../stores/image-likes';
const anime = useAnimeStore();
const imageLikes = useImageLikesStore();
const search = ref('');
const tag = ref('');
const state = ref('all');
const year = ref('');
const region = ref('');
const sort = ref<'slot' | 'year'>('slot');
const tags = computed(() => libraryTags(anime.items));
const years = computed(() => libraryYears(anime.items));
const regions = computed(() => libraryRegions(anime.items));
const filtered = computed(() =>
  filterLibraryItems(
    anime.items,
    'anime',
    { search: search.value, tag: tag.value, state: state.value, year: year.value, region: region.value, sort: sort.value },
    (item) => imageLikes.get(item).count
  )
);
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
        :label="contentLabel(item)"
        :like-count="imageLikes.get(item).count"
      />
    </div>
    <AppEmpty v-else title="没有匹配的动漫" message="调整搜索词或标签后重试。" />
  </div>
</template>
