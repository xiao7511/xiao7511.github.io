<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  contentLabel,
  contentRoute,
  contentTimestamp,
  fetchHomeData,
  type HomeData
} from '../services/home';
import HomeCarousel from '../components/HomeCarousel.vue';
import ContentImage from '../components/ContentImage.vue';
import AppAvatar from '../components/AppAvatar.vue';
import SocialIcon from '../components/SocialIcon.vue';
import { useAuthStore } from '../stores/auth';
import { useImageLikesStore } from '../stores/image-likes';
import { useToastStore } from '../stores/toast';
import { openSocialLink } from '../services/social-navigation';

const auth = useAuthStore();
const imageLikes = useImageLikesStore();
const toast = useToastStore();
const data = ref<HomeData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchHomeData();
    await imageLikes.load(data.value?.banners ?? []).catch(() => undefined);
  } catch {
    error.value = '首页内容加载失败，请检查网络后重试。';
  } finally {
    loading.value = false;
  }
}

function openSocial(link: HomeData['socialLinks'][number]): void {
  if (!openSocialLink(link.href, link.key)) toast.show('无法打开社交链接，请稍后重试', 'error');
}

function formatDate(timestamp: number): string {
  return timestamp ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(timestamp) : '';
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
    </div>

    <div class="home-dashboard">
      <div class="home-highlights">
        <section class="home-highlight home-highlight--updates" aria-labelledby="home-updates-title">
          <div class="home-highlight__heading">
            <h2 id="home-updates-title">最新更新</h2>
            <span>NEW</span>
          </div>
          <p v-if="loading" class="home-highlight__state">正在加载…</p>
          <div v-else-if="data?.updates.length" class="home-highlight__items">
            <RouterLink
              v-for="item in data.updates.slice(0, 2)"
              :key="item.id"
              :to="contentRoute(item)"
              class="home-highlight__item"
            >
              <ContentImage :src="item.cover_url" :alt="(item.title || '作品') + '缩略图'" />
              <span class="home-highlight__copy">
                <strong>{{ item.title || '未命名作品' }}</strong>
                <small>{{ formatDate(contentTimestamp(item)) || '最近更新' }}</small>
              </span>
            </RouterLink>
          </div>
          <p v-else class="home-highlight__state">暂无更新内容</p>
        </section>

        <section class="home-highlight home-highlight--ranking" aria-labelledby="home-ranking-title">
          <div class="home-highlight__heading">
            <h2 id="home-ranking-title">人气排行</h2>
            <span>TOP</span>
          </div>
          <p v-if="loading" class="home-highlight__state">正在加载…</p>
          <ol v-else-if="data?.ranking.length" class="home-highlight__items">
            <li v-for="(item, index) in data.ranking.slice(0, 2)" :key="item.id">
              <RouterLink :to="contentRoute(item)" class="home-highlight__item">
                <span class="home-highlight__number">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="home-highlight__copy">
                  <strong>{{ item.title || '未命名作品' }}</strong>
                  <small>{{ contentLabel(item) }} · ♡ {{ item.likeCount }}</small>
                </span>
              </RouterLink>
            </li>
          </ol>
          <p v-else class="home-highlight__state">暂无排行数据</p>
        </section>
      </div>

      <section class="home-social-strip" aria-label="关注 NOBI">
        <h2>关注 NOBI</h2>
        <nav v-if="data?.socialLinks.length" aria-label="NOBI 社交媒体">
          <a
            v-for="link in data.socialLinks"
            :key="link.key"
            :href="link.href"
            :class="'home-social__link--' + link.key"
            :aria-label="link.label"
            :title="link.label"
            target="_blank"
            rel="noopener noreferrer"
            @click.prevent="openSocial(link)"
          ><SocialIcon :name="link.key" /></a>
        </nav>
        <p v-else>更多社媒即将上线</p>
      </section>
    </div>
  </div>
</template>
