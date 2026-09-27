<script setup lang="ts">
import { useAppStore } from './stores/app';
import TabIcon from './components/TabIcon.vue';
import AppToast from './components/AppToast.vue';

const app = useAppStore();
const tabs = [
  { path: '/', label: '首页', icon: 'home' },
  { path: '/anime', label: '动漫', icon: 'anime' },
  { path: '/manga', label: '漫画', icon: 'manga' },
  { path: '/community', label: '社区', icon: 'community' },
  { path: '/profile', label: '我的', icon: 'profile' }
];
</script>

<template>
  <div class="app-shell">
    <div v-if="!app.online" class="offline-bar" role="status">当前离线，内容可能无法更新</div>
    <main id="main-content"><RouterView /></main>
    <nav class="tab-bar" aria-label="主导航">
      <RouterLink v-for="tab in tabs" :key="tab.path" :to="tab.path" class="tab-bar__item" :aria-label="tab.label">
        <TabIcon :name="tab.icon" /><span>{{ tab.label }}</span>
      </RouterLink>
    </nav>
    <AppToast />
  </div>
</template>
