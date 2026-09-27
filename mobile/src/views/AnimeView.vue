<script setup lang="ts">
import { onMounted } from 'vue';
import { useAnimeStore } from '../stores/anime';
import ContentCard from '../components/ContentCard.vue';
const anime = useAnimeStore();
onMounted(() => { if (!anime.items.length) void anime.load(); });
</script>

<template>
  <div class="page listing-page"><div class="page-heading"><span class="eyebrow">EXPLORE</span><h1>动漫</h1><p>探索 NOBI 动漫推荐</p></div>
    <div v-if="anime.loading" class="card-grid"><div v-for="n in 4" :key="n" class="card-skeleton"></div></div>
    <p v-else-if="anime.error" class="state-message">{{ anime.error }} <button type="button" @click="anime.load">重试</button></p>
    <div v-else-if="anime.items.length" class="card-grid"><ContentCard v-for="item in anime.items" :key="`${item.category}-${item.slot_index}`" :item="item" /></div>
    <p v-else class="state-message">暂无动漫推荐</p>
  </div>
</template>
