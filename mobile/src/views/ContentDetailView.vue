<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ContentItem } from '../types/content';
import { useAnimeStore } from '../stores/anime';
import { useMangaStore } from '../stores/manga';
import { fetchContentDetail } from '../services/content';
import { contentWebUrl } from '../services/urls';
import { webOrigin } from '../services/config';
import { shareContent } from '../services/native';
import { useToastStore } from '../stores/toast';
import ContentImage from '../components/ContentImage.vue';
import AppLoading from '../components/AppLoading.vue';
import AppError from '../components/AppError.vue';
import { isDisplayableImageUrl } from '../services/images';
import { contentYear, WEB_HOME_BANNER_SLOTS } from '../services/home';
import ContentCard from '../components/ContentCard.vue';
import { useImageLikesStore } from '../stores/image-likes';
import { contentCoverLikeTarget, contentDetailLikeTargets, type ImageLikeTarget } from '../services/image-likes';
import { parseRouteInteger } from '../router/safe-navigation';

const route = useRoute();
const router = useRouter();
const anime = useAnimeStore();
const manga = useMangaStore();
const toast = useToastStore();
const imageLikes = useImageLikesStore();
const item = ref<ContentItem | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const category = computed<'anime' | 'manga' | 'banner'>(() => {
  if (route.path.startsWith('/manga')) return 'manga';
  if (route.path.startsWith('/banner')) return 'banner';
  return 'anime';
});
const detailTargets = computed(() => (item.value ? contentDetailLikeTargets(item.value) : []));
const detailEntries = computed(() =>
  (item.value?.detail_urls ?? []).flatMap((url, index) => {
    if (!isDisplayableImageUrl(url)) return [];
    const target = detailTargets.value.find((entry) => entry.index === index) ?? null;
    return [{ url, index, target }];
  }).filter((entry, _index, entries) => {
    const key = entry.target?.imageKey || entry.url;
    return entries.findIndex((candidate) => (candidate.target?.imageKey || candidate.url) === key) === _index;
  })
);
const detailImages = computed(() => detailEntries.value.map((entry) => entry.url));
const likeTarget = computed(() => (item.value ? contentCoverLikeTarget(item.value) : null));
const likeSummary = computed(() => (item.value ? imageLikes.get(item.value) : { count: 0, liked: false }));
const related = computed(() => {
  const rows = category.value === 'anime' ? anime.items : category.value === 'manga' ? manga.items : [];
  return rows.filter((entry) => entry.id !== item.value?.id).slice(0, 4);
});
const readerPage = ref(1);
const nightReading = ref(true);
const comfortableReading = ref(false);
let loadSequence = 0;
function goToPage(page: number): void {
  readerPage.value = Math.min(Math.max(1, page), detailImages.value.length || 1);
  globalThis.document?.getElementById(`reader-page-${readerPage.value}`)?.scrollIntoView({ behavior: 'smooth' });
}

async function load(): Promise<void> {
  const sequence = ++loadSequence;
  loading.value = true;
  error.value = null;
  try {
    if (category.value === 'banner') {
      const slot = parseRouteInteger(route.params.slot);
      if (slot === null || slot >= WEB_HOME_BANNER_SLOTS) throw new Error('NOT_FOUND');
      const banner = await fetchContentDetail('banner', slot);
      if (sequence !== loadSequence) return;
      if (banner.id !== String(route.params.id) || banner.is_active === false) throw new Error('NOT_FOUND');
      item.value = banner;
      await imageLikes
        .loadTargets(
          [contentCoverLikeTarget(banner), ...contentDetailLikeTargets(banner)].filter(Boolean) as ImageLikeTarget[]
        )
        .catch(() => undefined);
      return;
    }
    const store = category.value === 'anime' ? anime : manga;
    if (!store.items.length) await store.load();
    if (sequence !== loadSequence) return;
    const summary = store.items.find((entry) => entry.id === String(route.params.id));
    if (!summary) throw new Error('NOT_FOUND');
    const detail = await fetchContentDetail(category.value, summary.slot_index);
    if (sequence !== loadSequence) return;
    if (detail.id !== summary.id || detail.category !== category.value || detail.is_active === false) throw new Error('NOT_FOUND');
    item.value = detail;
    await imageLikes
      .loadTargets(
        [contentCoverLikeTarget(item.value), ...contentDetailLikeTargets(item.value)].filter(
          Boolean
        ) as ImageLikeTarget[]
      )
      .catch(() => undefined);
  } catch {
    if (sequence !== loadSequence) return;
    item.value = null;
    error.value = '作品详情加载失败或已不存在。';
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

async function toggleLike(): Promise<void> {
  if (!item.value) return;
  try {
    await imageLikes.toggle(item.value);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'AUTH_REQUIRED') {
      toast.show('登录后即可点赞', 'info');
      await router.push({ name: 'login', query: { redirect: route.fullPath } });
      return;
    }
    toast.show('点赞失败，请稍后重试', 'error');
  }
}

async function toggleGalleryLike(target: ImageLikeTarget): Promise<void> {
  try {
    await imageLikes.toggleTarget(target);
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'AUTH_REQUIRED') {
      toast.show('登录后即可点赞', 'info');
      await router.push({ name: 'login', query: { redirect: route.fullPath } });
      return;
    }
    toast.show('点赞失败，请稍后重试', 'error');
  }
}

async function share(): Promise<void> {
  if (!item.value) return;
  try {
    await shareContent(
      item.value.title || 'NOBI 作品',
      category.value === 'banner'
        ? `${webOrigin()}/recommend.html`
        : contentWebUrl(category.value, item.value.slot_index),
      item.value.theme_tags?.join('、')
    );
    toast.show('分享内容已准备好', 'success');
  } catch {
    toast.show('分享失败，请稍后重试', 'error');
  }
}
onMounted(load);
watch(() => route.fullPath, load);
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
        <button class="detail-share-button" type="button" aria-label="分享" @click="share">↗</button>
        <div class="detail-hero__content">
          <div class="detail-poster">
            <ContentImage :src="item.cover_url" :alt="item.title || '作品封面'" />
            <button
              v-if="likeTarget"
              type="button"
              class="detail-like-button"
              :class="{ 'is-liked': likeSummary.liked }"
              :aria-pressed="likeSummary.liked"
              :disabled="imageLikes.isPending(item)"
              @click="toggleLike"
            >
              <span aria-hidden="true">{{ likeSummary.liked ? '♥' : '♡' }}</span>
              {{ likeSummary.count }}
            </button>
          </div>
          <div>
            <span class="eyebrow">{{
              category === 'banner' ? 'FEATURED' : category === 'anime' ? 'ANIME' : 'MANGA'
            }}</span>
            <h1>{{ item.title || '未命名作品' }}</h1>
            <p v-if="contentYear(item) !== '--'" class="detail-meta">
              {{ contentYear(item) }}
            </p>
            <p v-if="item.subtitle">{{ item.subtitle }}</p>
            <div class="tag-row">
              <span v-for="tagName in item.theme_tags" :key="tagName">{{ tagName }}</span>
            </div>
            <button
              v-if="category === 'manga' && detailImages.length"
              type="button"
              class="primary-button"
              @click="goToPage(1)"
            >
              开始阅读
            </button>
          </div>
        </div>
      </section>
      <section v-if="item.description || item.subtitle" class="detail-copy page">
        <span class="eyebrow">STORY</span>
        <h2>简介</h2>
        <p>{{ item.description || item.subtitle }}</p>
      </section>
      <section
        v-if="detailImages.length"
        class="detail-gallery page"
        :class="{
          'manga-reader': category === 'manga',
          'reader-night': category === 'manga' && nightReading,
          'reader-comfort': category === 'manga' && comfortableReading
        }"
      >
        <div class="section-heading">
          <div>
            <span class="eyebrow">GALLERY</span>
            <h2>{{ category === 'manga' ? '纵向阅读' : '作品图集' }}</h2>
          </div>
        </div>
        <div class="gallery-list">
          <div
            v-for="(entry, displayIndex) in detailEntries"
            :id="`reader-page-${displayIndex + 1}`"
            :key="entry.target?.imageKey || entry.url"
            class="gallery-image-shell"
          >
            <ContentImage :src="entry.url" :alt="`${item.title || '作品'}图片 ${displayIndex + 1}`" />
            <button
              v-if="entry.target"
              type="button"
              class="gallery-like-button"
              :class="{ 'is-liked': imageLikes.getTarget(entry.target).liked }"
              :aria-pressed="imageLikes.getTarget(entry.target).liked"
              :aria-label="`${imageLikes.getTarget(entry.target).liked ? '取消点赞' : '点赞'}第 ${displayIndex + 1} 张图片`"
              :disabled="imageLikes.isTargetPending(entry.target)"
              @click.stop="toggleGalleryLike(entry.target)"
            >
              <span aria-hidden="true">{{ imageLikes.getTarget(entry.target).liked ? '♥' : '♡' }}</span>
              {{ imageLikes.getTarget(entry.target).count }}
            </button>
          </div>
        </div>
      </section>
      <section v-else class="detail-gallery page" aria-live="polite">
        <div class="section-heading">
          <div>
            <span class="eyebrow">GALLERY</span>
            <h2>暂无详情图片</h2>
          </div>
        </div>
      </section>
      <nav v-if="category === 'manga' && detailImages.length" class="reader-controls" aria-label="漫画阅读控制">
        <span>{{ readerPage }} / {{ detailImages.length }}</span>
        <button type="button" :disabled="readerPage <= 1" @click="goToPage(readerPage - 1)">上一页</button>
        <button type="button" @click="goToPage(1)">目录</button>
        <button type="button" :disabled="readerPage >= detailImages.length" @click="goToPage(readerPage + 1)">
          下一页
        </button>
        <button type="button" :aria-pressed="nightReading" @click="nightReading = !nightReading">夜间</button>
        <button type="button" :aria-pressed="comfortableReading" @click="comfortableReading = !comfortableReading">
          设置
        </button>
      </nav>
      <section v-if="related.length" class="page detail-related">
        <div class="section-heading">
          <div>
            <span class="eyebrow">MORE</span>
            <h2>相关推荐</h2>
          </div>
        </div>
        <div class="card-grid home-card-grid">
          <ContentCard v-for="entry in related" :key="entry.id" :item="entry" />
        </div>
      </section>
    </template>
  </div>
</template>
