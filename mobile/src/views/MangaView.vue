<script setup lang="ts">
import { onMounted } from 'vue';
import { useMangaStore } from '../stores/manga';
import ContentCard from '../components/ContentCard.vue';
const manga = useMangaStore();
onMounted(() => { if (!manga.items.length) void manga.load(); });
</script>

<template>
  <div class="page listing-page"><div class="page-heading"><span class="eyebrow">EXPLORE</span><h1>漫画</h1><p>发现 NOBI 漫画连载</p></div>
    <div v-if="manga.loading" class="card-grid"><div v-for="n in 4" :key="n" class="card-skeleton"></div></div>
    <p v-else-if="manga.error" class="state-message">{{ manga.error }} <button type="button" @click="manga.load">重试</button></p>
    <div v-else-if="manga.items.length" class="card-grid"><ContentCard v-for="item in manga.items" :key="`${item.category}-${item.slot_index}`" :item="item" /></div>
    <p v-else class="state-message">暂无漫画连载</p>
  </div>
</template>
