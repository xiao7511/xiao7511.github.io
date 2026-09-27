<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ContentItem } from '../types/content';
import { contentRoute } from '../services/home';
import ContentImage from './ContentImage.vue';

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

function stop(): void {
  if (timer) globalThis.clearInterval(timer);
  timer = undefined;
}

function start(): void {
  stop();
  if (props.items.length <= 1 || globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = globalThis.setInterval(() => show(activeIndex.value + 1), 5000);
}

function show(index: number): void {
  if (!props.items.length) return;
  activeIndex.value = (index + props.items.length) % props.items.length;
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
onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <section
    v-if="active"
    class="home-carousel"
    aria-roledescription="轮播图"
    :aria-label="`精选内容，第 ${activeIndex + 1} 张，共 ${items.length} 张`"
    @touchstart.passive="beginSwipe"
    @touchend.passive="endSwipe"
  >
    <RouterLink :to="contentRoute(active)" class="home-carousel__link" @click="handleClick">
      <ContentImage :src="active.cover_url" :alt="active.title || '精选内容'" />
      <div class="home-carousel__shade"></div>
      <div class="home-carousel__content">
        <div v-if="active.year || active.theme_tags?.length" class="home-carousel__tags">
          <span v-if="active.year">{{ active.year }} · 新番</span>
          <span v-for="tag in (active.theme_tags ?? []).slice(0, 4)" :key="tag">{{ tag }}</span>
        </div>
        <h1>{{ active.title || '未命名作品' }}</h1>
        <p v-if="active.subtitle">{{ active.subtitle }}</p>
        <strong>查看详情 ›</strong>
      </div>
    </RouterLink>
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
