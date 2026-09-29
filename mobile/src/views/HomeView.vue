<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  contentLabel,
  contentRoute,
  contentTimestamp,
  contentYear,
  fetchHomeData,
  type HomeData
} from '../services/home';
import HomeCarousel from '../components/HomeCarousel.vue';
import ContentCard from '../components/ContentCard.vue';
import ContentImage from '../components/ContentImage.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import AppAvatar from '../components/AppAvatar.vue';
import SocialIcon from '../components/SocialIcon.vue';
import { useAuthStore } from '../stores/auth';
import { useImageLikesStore } from '../stores/image-likes';

const auth = useAuthStore();
const imageLikes = useImageLikesStore();
const data = ref<HomeData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchHomeData();
    await imageLikes
      .load([...(data.value?.popular ?? []), ...(data.value?.recommendations ?? [])])
      .catch(() => undefined);
  } catch {
    error.value = '首页内容加载失败，请检查网络后重试。';
  } finally {
    loading.value = false;
  }
}

function formatDate(timestamp: number): string {
  return timestamp ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(timestamp) : '';
}

onMounted(load);
</script>

<template>
  <div class="page home-page home-aligned">
    <header class="home-header">
      <div class="brand">
        <span>NOBI <small>动漫</small></span>
      </div>
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
    <div v-else-if="error" class="state-message">
      <p>{{ error }}</p>
      <button type="button" @click="load">重试</button>
    </div>
    <HomeCarousel v-else-if="data?.banners.length" :items="data.banners" />
    <p v-else class="state-message">当前没有轮播内容</p>

    <section class="content-section">
      <div class="section-heading">
        <h2>本季热门</h2>
        <RouterLink to="/anime">查看更多 ›</RouterLink>
      </div>
      <AppSkeleton v-if="loading" />
      <div v-else-if="data?.popular.length" class="card-grid home-card-grid">
        <ContentCard
          v-for="item in data.popular.slice(0, 4)"
          :key="item.id"
          :item="item"
          :year="contentYear(item)"
          :label="contentLabel(item)"
          :like-count="item.likeCount"
        />
      </div>
      <p v-else class="state-message">暂无热门内容</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <h2>新番推荐</h2>
        <RouterLink to="/manga">查看更多 ›</RouterLink>
      </div>
      <AppSkeleton v-if="loading" />
      <div v-else-if="data?.recommendations.length" class="card-grid home-card-grid">
        <ContentCard
          v-for="item in data.recommendations.slice(0, 4)"
          :key="item.id"
          :item="item"
          :year="contentYear(item)"
          :label="contentLabel(item)"
          :like-count="item.likeCount"
        />
      </div>
      <p v-else class="state-message">暂无新番推荐</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <h2>最近更新</h2>
      </div>
      <AppSkeleton v-if="loading" :count="2" />
      <div v-else-if="data?.updates.length" class="home-update-list">
        <RouterLink v-for="item in data.updates" :key="item.id" :to="contentRoute(item)" class="home-update-card">
          <ContentImage :src="item.cover_url" :alt="`${item.title || '作品'}缩略图`" />
          <div>
            <h3>{{ item.title || '未命名作品' }}</h3>
            <p v-if="item.subtitle">{{ item.subtitle }}</p>
            <time>{{ formatDate(contentTimestamp(item)) }} 更新</time>
          </div>
        </RouterLink>
      </div>
      <p v-else class="state-message">暂无更新内容</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <h2>人气排行榜</h2>
      </div>
      <AppSkeleton v-if="loading" :count="2" />
      <ol v-else-if="data?.ranking.length" class="home-ranking-list">
        <li v-for="(item, index) in data.ranking" :key="item.id">
          <span class="home-ranking-number">{{ index + 1 }}</span>
          <RouterLink :to="contentRoute(item)">
            <ContentImage :src="item.cover_url" alt="" />
            <div>
              <h3>{{ item.title || '未命名作品' }}</h3>
              <span>{{ contentLabel(item) }}</span
              ><strong>♡ {{ item.likeCount }}</strong>
            </div>
          </RouterLink>
        </li>
      </ol>
      <p v-else class="state-message">暂无排行数据</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <h2>最新资讯</h2>
      </div>
      <AppSkeleton v-if="loading" :count="2" />
      <div v-else-if="data?.news.length" class="home-news-list">
        <RouterLink v-for="item in data.news" :key="item.id" :to="contentRoute(item)">
          <ContentImage :src="item.cover_url" alt="" />
          <div>
            <h3>{{ item.title || '未命名作品' }}</h3>
            <p v-if="item.subtitle">{{ item.subtitle }}</p>
            <time>{{ formatDate(contentTimestamp(item)) }}</time>
          </div>
        </RouterLink>
      </div>
      <p v-else class="state-message">暂无最新资讯</p>
    </section>

    <section v-if="data?.socialLinks.length" class="content-section home-social">
      <div class="section-heading">
        <h2>关注 NOBI</h2>
      </div>
      <nav aria-label="NOBI 社交媒体">
        <a
          v-for="link in data.socialLinks"
          :key="link.key"
          :href="link.href"
          :class="`home-social__link--${link.key}`"
          :aria-label="link.label"
          :title="link.label"
          target="_blank"
          rel="noopener noreferrer"
          ><SocialIcon :name="link.key"
        /></a>
      </nav>
    </section>
  </div>
</template>
