<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAnimeStore } from '../stores/anime';
import { useMangaStore } from '../stores/manga';
import ContentCard from '../components/ContentCard.vue';
import ContentImage from '../components/ContentImage.vue';
import { shareContent } from '../services/native';

const anime = useAnimeStore();
const manga = useMangaStore();
const featured = computed(() => anime.items[0]);
onMounted(() => { if (!anime.items.length) void anime.load(); if (!manga.items.length) void manga.load(); });

async function share(): Promise<void> {
  if (!featured.value) return;
  const item = featured.value;
  if (!['anime', 'manga'].includes(item.category) || !Number.isInteger(item.slot_index)) return;
  const url = `https://www.nobistudio.com/detail.html?${new URLSearchParams({ category: item.category, slot: String(item.slot_index) })}`;
  await shareContent(item.title, url);
}
</script>

<template>
  <div class="page home-page">
    <header class="home-header">
      <div class="brand"><span class="brand__mark">N</span><span>NOBI<small>动漫</small></span></div>
      <RouterLink to="/anime" class="header-action" aria-label="浏览动漫"><span aria-hidden="true">⌕</span></RouterLink>
      <RouterLink to="/profile" class="header-action header-action--avatar" aria-label="我的账号"><span aria-hidden="true">◉</span></RouterLink>
    </header>

    <section class="hero" aria-label="本季精选">
      <template v-if="featured">
        <ContentImage :src="featured.banner_url || featured.cover_url" :alt="featured.title" />
        <div class="hero__shade"></div>
        <div class="hero__content"><span class="eyebrow">NOBI · 本季精选</span><h1>{{ featured.title }}</h1><p>{{ featured.subtitle || '发现更多精彩动漫' }}</p><button class="hero__share" type="button" @click="share">分享作品 ↗</button></div>
      </template>
      <div v-else-if="anime.loading" class="hero__skeleton" role="status">正在加载精选内容…</div>
      <div v-else class="hero__empty"><span>NOBI 精选</span><p>{{ anime.error || '当前暂无推荐作品' }}</p><button v-if="anime.error" type="button" @click="anime.load">重试</button></div>
    </section>

    <section class="content-section">
      <div class="section-heading"><div><span class="eyebrow">ANIME</span><h2>新番推荐</h2></div><RouterLink to="/anime">查看全部 <span aria-hidden="true">›</span></RouterLink></div>
      <div v-if="anime.loading" class="card-grid" aria-label="加载中"><div v-for="n in 4" :key="n" class="card-skeleton"></div></div>
      <p v-else-if="anime.error" class="state-message">{{ anime.error }} <button type="button" @click="anime.load">重试</button></p>
      <div v-else-if="anime.items.length" class="card-grid"><ContentCard v-for="item in anime.items.slice(0, 4)" :key="`${item.category}-${item.slot_index}`" :item="item" /></div>
      <p v-else class="state-message">暂无动漫推荐</p>
    </section>

    <section class="content-section">
      <div class="section-heading"><div><span class="eyebrow">MANGA</span><h2>热门漫画</h2></div><RouterLink to="/manga">查看全部 <span aria-hidden="true">›</span></RouterLink></div>
      <div v-if="manga.loading" class="card-grid" aria-label="加载中"><div v-for="n in 2" :key="n" class="card-skeleton"></div></div>
      <p v-else-if="manga.error" class="state-message">{{ manga.error }} <button type="button" @click="manga.load">重试</button></p>
      <div v-else-if="manga.items.length" class="card-grid"><ContentCard v-for="item in manga.items.slice(0, 2)" :key="`${item.category}-${item.slot_index}`" :item="item" /></div>
      <p v-else class="state-message">暂无漫画内容</p>
    </section>

    <RouterLink to="/community" class="community-teaser"><span class="eyebrow">COMMUNITY</span><strong>和同好一起聊聊</strong><span>进入社区 <span aria-hidden="true">↗</span></span></RouterLink>
  </div>
</template>
