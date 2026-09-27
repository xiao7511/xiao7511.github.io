<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ContentItem } from '../types/content';
import { useAnimeStore } from '../stores/anime';
import { useMangaStore } from '../stores/manga';
import { fetchContentDetail } from '../services/content';
import { contentWebUrl } from '../services/urls';
import { shareContent } from '../services/native';
import { useToastStore } from '../stores/toast';
import ContentImage from '../components/ContentImage.vue';
import AppLoading from '../components/AppLoading.vue';
import AppError from '../components/AppError.vue';
import { isDisplayableImageUrl } from '../services/images';

const route = useRoute();
const router = useRouter();
const anime = useAnimeStore();
const manga = useMangaStore();
const toast = useToastStore();
const item = ref<ContentItem | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const category = computed<'anime' | 'manga'>(() => (route.path.startsWith('/manga') ? 'manga' : 'anime'));
const detailImages = computed(() => item.value?.detail_urls?.filter(isDisplayableImageUrl) ?? []);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const store = category.value === 'anime' ? anime : manga;
    if (!store.items.length) await store.load();
    const summary = store.items.find((entry) => entry.id === String(route.params.id));
    if (!summary) throw new Error('NOT_FOUND');
    item.value = await fetchContentDetail(category.value, summary.slot_index);
  } catch {
    item.value = null;
    error.value = '作品详情加载失败或已不存在。';
  } finally {
    loading.value = false;
  }
}

async function share(): Promise<void> {
  if (!item.value) return;
  try {
    await shareContent(
      item.value.title || 'NOBI 作品',
      contentWebUrl(category.value, item.value.slot_index),
      item.value.theme_tags?.join('、')
    );
    toast.show('分享内容已准备好', 'success');
  } catch {
    toast.show('分享失败，请稍后重试', 'error');
  }
}
onMounted(load);
</script>
<template>
  <div class="detail-page">
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <template v-else-if="item">
      <section class="detail-hero">
        <ContentImage :src="item.cover_url" :alt="item.title || '作品封面'" />
        <div class="detail-hero__shade"></div>
        <button class="back-button" type="button" aria-label="返回" @click="router.back">‹</button>
        <div class="detail-hero__content">
          <div class="detail-poster"><ContentImage :src="item.cover_url" :alt="item.title || '作品封面'" /></div>
          <div>
            <span class="eyebrow">{{ category === 'anime' ? 'ANIME' : 'MANGA' }}</span>
            <h1>{{ item.title || '未命名作品' }}</h1>
            <p v-if="item.subtitle">{{ item.subtitle }}</p>
            <div class="tag-row">
              <span v-for="tagName in item.theme_tags" :key="tagName">{{ tagName }}</span>
            </div>
            <button type="button" class="primary-button" @click="share">分享作品</button>
          </div>
        </div>
      </section>
      <section v-if="detailImages.length" class="detail-gallery page">
        <div class="section-heading">
          <div>
            <span class="eyebrow">GALLERY</span>
            <h2>作品图集</h2>
          </div>
        </div>
        <div class="gallery-list">
          <ContentImage
            v-for="(url, index) in detailImages"
            :key="url"
            :src="url"
            :alt="`${item.title || '作品'}图片 ${index + 1}`"
          />
        </div>
      </section>
    </template>
  </div>
</template>
