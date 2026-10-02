<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ContentItem } from '../types/content';
import { contentRoute } from '../services/home';
import ContentImage from './ContentImage.vue';
import { publicVideoUrl } from '../services/cinematic-media';

const props = defineProps<{ items: ContentItem[] }>();
interface SwipeEvent {
  changedTouches: { [index: number]: { clientX: number } | undefined };
}
interface ClickEvent {
  preventDefault(): void;
}
const activeIndex = ref(0);
const touchStart = ref<number | null>(null);
const suppressClick = ref(false);
let timer: ReturnType<typeof globalThis.setInterval> | undefined;
const active = computed(() => props.items[activeIndex.value]);
const root = ref<globalThis.HTMLElement | null>(null);
const video = ref<globalThis.HTMLVideoElement | null>(null);
const videoReady = ref(false);
const muted = ref(true);
const inViewport = ref(true);
const reduced = ref(typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
const videoUrl = computed(() => (reduced.value ? '' : publicVideoUrl(active.value?.video_url)));
let observer: globalThis.IntersectionObserver | undefined;

function syncVideo(): void {
  const player = video.value;
  if (!player) return;
  if (inViewport.value && !globalThis.document.hidden && videoUrl.value) {
    void player.play().catch(() => (videoReady.value = false));
  } else {
    muted.value = true;
    player.pause();
  }
}

function onVisibility(): void {
  if (globalThis.document.hidden) stop();
  else start();
  syncVideo();
}

function toggleMute(): void { muted.value = !muted.value; }

function stop(): void {
  if (timer) globalThis.clearInterval(timer);
  timer = undefined;
}

function start(): void {
  stop();
  if (props.items.length <= 1 || reduced.value || globalThis.document.hidden || !inViewport.value) return;
  timer = globalThis.setInterval(() => show(activeIndex.value + 1), 5000);
}

function show(index: number): void {
  if (!props.items.length) return;
  videoReady.value = false;
  muted.value = true;
  activeIndex.value = (index + props.items.length) % props.items.length;
  globalThis.setTimeout(syncVideo, 0);
}

function select(index: number): void {
  show(index);
  start();
}

function beginSwipe(event: SwipeEvent): void {
  touchStart.value = event.changedTouches[0]?.clientX ?? null;
  suppressClick.value = false;
  stop();
}

function endSwipe(event: SwipeEvent): void {
  const end = event.changedTouches[0]?.clientX;
  if (touchStart.value !== null && end !== undefined) {
    const distance = end - touchStart.value;
    if (distance > 50) {
      suppressClick.value = true;
      show(activeIndex.value - 1);
    }
    if (distance < -50) {
      suppressClick.value = true;
      show(activeIndex.value + 1);
    }
  }
  touchStart.value = null;
  start();
}

function handleClick(event: ClickEvent): void {
  if (!suppressClick.value) return;
  event.preventDefault();
  suppressClick.value = false;
}

watch(
  () => props.items,
  () => {
    activeIndex.value = Math.min(activeIndex.value, Math.max(0, props.items.length - 1));
    start();
  }
);
onMounted(() => {
  start();
  if (root.value && typeof globalThis.IntersectionObserver !== 'undefined') {
    observer = new globalThis.IntersectionObserver(([entry]) => {
      inViewport.value = Boolean(entry?.isIntersecting);
      if (inViewport.value) start();
      else stop();
      syncVideo();
    }, { threshold: 0.1 });
    observer.observe(root.value);
  }
  globalThis.document.addEventListener('visibilitychange', onVisibility);
  syncVideo();
});
onBeforeUnmount(() => {
  stop();
  video.value?.pause();
  observer?.disconnect();
  globalThis.document.removeEventListener('visibilitychange', onVisibility);
});
watch(videoUrl, () => {
  videoReady.value = false;
  globalThis.setTimeout(syncVideo, 0);
});
</script>

<template>
  <section
    v-if="active"
    ref="root"
    class="home-carousel"
    aria-roledescription="轮播图"
    :aria-label="`精选内容，第 ${activeIndex + 1} 张，共 ${items.length} 张`"
    @touchstart.passive="beginSwipe"
    @touchend.passive="endSwipe"
  >
    <RouterLink :to="contentRoute(active)" class="home-carousel__link" @click="handleClick">
      <ContentImage :src="active.cover_url" :alt="active.title || '精选内容'" eager />
      <video v-if="videoUrl" ref="video" class="home-carousel__video" :class="{ 'is-ready': videoReady }" :src="videoUrl" :muted="muted" autoplay loop playsinline preload="metadata" aria-hidden="true" @canplay="videoReady = true; syncVideo()" @error="videoReady = false"></video>
      <div class="home-carousel__shade"></div>
      <div class="home-carousel__content">
        <h1>{{ active.title || '未命名作品' }}</h1>
        <p v-if="active.subtitle">{{ active.subtitle }}</p>
        <div v-if="active.year || active.theme_tags?.length" class="home-carousel__tags">
          <span v-if="active.year">{{ active.year }}</span>
          <span v-for="tag in (active.theme_tags ?? []).slice(0, 3)" :key="tag">{{ tag }}</span>
        </div>
        <strong class="home-carousel__cta">▶ 立即查看</strong>
      </div>
    </RouterLink>
    <button v-if="videoUrl" class="home-carousel__mute" type="button" :aria-label="muted ? '开启视频声音' : '静音视频'" :aria-pressed="!muted" @click="toggleMute">♪</button>
    <div v-if="items.length > 1" class="home-carousel__dots" aria-label="选择轮播内容">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        :class="{ 'is-active': index === activeIndex }"
        :aria-label="`查看第 ${index + 1} 张：${item.title || '未命名作品'}`"
        :aria-current="index === activeIndex ? 'true' : undefined"
        @click="select(index)"
      ></button>
    </div>
  </section>
</template>
