<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { contentRoute, fetchHomeData, type HomeData } from '../services/home';
import HomeCarousel from '../components/HomeCarousel.vue';
import AppAvatar from '../components/AppAvatar.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const data = ref<HomeData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchHomeData();
  } catch {
    error.value = '首页内容加载失败，请检查网络后重试。';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page home-page home-aligned">
    <div class="home-stage">
      <header class="home-header">
        <div class="brand"><span>NOBI <small>动漫</small></span></div>
        <RouterLink to="/search" class="header-action" aria-label="搜索"><span aria-hidden="true">⌕</span></RouterLink>
        <RouterLink to="/profile" class="home-account" aria-label="我的账号">
          <AppAvatar
            :src="auth.profile?.avatar_url"
            :user-id="auth.user?.id"
            :name="auth.user ? auth.profile?.nickname || auth.user.email?.split('@')[0] || 'NOBI' : 'NOBI'"
          />
        </RouterLink>
      </header>

      <div v-if="loading" class="home-carousel home-carousel--loading" role="status">正在加载轮播内容…</div>
      <div v-else-if="error" class="home-stage__state" role="alert">
        <p>{{ error }}</p>
        <button type="button" @click="load">重试</button>
      </div>
      <HomeCarousel v-else-if="data?.banners.length" :items="data.banners" />
      <div v-else class="home-stage__state">当前没有轮播内容</div>

      <div class="home-topline" aria-label="首页更新与排行">
        <section class="home-topline__section" aria-labelledby="home-updates-title">
          <h2 id="home-updates-title">最新更新 <span>NEW</span></h2>
          <RouterLink v-if="data?.updates[0]" :to="contentRoute(data.updates[0])">
            <strong>{{ data.updates[0].title || '未命名作品' }}</strong><span aria-hidden="true">↗</span>
          </RouterLink>
          <small v-else>{{ loading ? '正在加载…' : '暂无更新' }}</small>
        </section>
        <section class="home-topline__section" aria-labelledby="home-ranking-title">
          <h2 id="home-ranking-title">人气排行 <span>TOP 01</span></h2>
          <RouterLink v-if="data?.ranking[0]" :to="contentRoute(data.ranking[0])">
            <strong>{{ data.ranking[0].title || '未命名作品' }}</strong><span aria-hidden="true">↗</span>
          </RouterLink>
          <small v-else>{{ loading ? '正在加载…' : '暂无排行' }}</small>
        </section>
      </div>
    </div>
  </div>
</template>
