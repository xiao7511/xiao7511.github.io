<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAnimeStore } from '../stores/anime';
import { useMangaStore } from '../stores/manga';
import { useCommunityStore } from '../stores/community';
import ContentCard from '../components/ContentCard.vue';
import ContentImage from '../components/ContentImage.vue';
import AppSkeleton from '../components/AppSkeleton.vue';

const anime = useAnimeStore();
const manga = useMangaStore();
const community = useCommunityStore();
const featured = computed(() => anime.items.find((item) => item.title) ?? anime.items[0]);
const hotPosts = computed(() => [...community.posts].sort((a, b) => b.likeCount - a.likeCount).slice(0, 2));
onMounted(() => {
  if (!anime.items.length) void anime.load();
  if (!manga.items.length) void manga.load();
  if (!community.posts.length) void community.load(1);
});
</script>
<template>
  <div class="page home-page">
    <header class="home-header">
      <div class="brand">
        <span class="brand__mark">N</span><span>NOBI<small>动漫</small></span>
      </div>
      <RouterLink to="/anime" class="header-action" aria-label="浏览动漫">⌕</RouterLink
      ><RouterLink to="/profile" class="header-action header-action--avatar" aria-label="我的账号">◉</RouterLink>
    </header>
    <RouterLink v-if="featured" :to="`/anime/${featured.id}`" class="hero" aria-label="本季精选"
      ><ContentImage :src="featured.cover_url" :alt="featured.title || '精选作品'" />
      <div class="hero__shade"></div>
      <div class="hero__content">
        <span class="eyebrow">NOBI · 本季精选</span>
        <h1>{{ featured.title || '未命名作品' }}</h1>
        <p>{{ featured.theme_tags?.join(' · ') || featured.subtitle || '发现更多精彩内容' }}</p>
        <span class="hero__share">查看详情 ›</span>
      </div></RouterLink
    >
    <div v-else-if="anime.loading" class="hero hero__skeleton" role="status">正在加载精选内容…</div>
    <div v-else class="hero hero__empty">
      <span>NOBI 精选</span>
      <p>{{ anime.error || '当前暂无推荐作品' }}</p>
      <button v-if="anime.error" type="button" @click="anime.load">重试</button>
    </div>
    <section class="content-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">SEASON</span>
          <h2>本季热门</h2>
        </div>
      </div>
      <p class="state-message">生产 API 暂未提供独立热门榜单。</p>
    </section>
    <section class="content-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">ANIME</span>
          <h2>新番推荐</h2>
        </div>
        <RouterLink to="/anime">查看全部 ›</RouterLink>
      </div>
      <AppSkeleton v-if="anime.loading" />
      <p v-else-if="anime.error" class="state-message">{{ anime.error }}</p>
      <div v-else-if="anime.items.length" class="card-grid">
        <ContentCard v-for="entry in anime.items.slice(0, 4)" :key="entry.id" :item="entry" />
      </div>
      <p v-else class="state-message">暂无动漫推荐</p>
    </section>
    <section class="content-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">MANGA</span>
          <h2>热门漫画</h2>
        </div>
        <RouterLink to="/manga">查看全部 ›</RouterLink>
      </div>
      <AppSkeleton v-if="manga.loading" :count="2" />
      <p v-else-if="manga.error" class="state-message">{{ manga.error }}</p>
      <div v-else-if="manga.items.length" class="card-grid">
        <ContentCard v-for="entry in manga.items.slice(0, 2)" :key="entry.id" :item="entry" />
      </div>
      <p v-else class="state-message">暂无漫画内容</p>
    </section>
    <section class="content-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">COMMUNITY</span>
          <h2>社区热门</h2>
        </div>
        <RouterLink to="/community">进入社区 ›</RouterLink>
      </div>
      <AppSkeleton v-if="community.loading" :count="2" variant="post" />
      <div v-else-if="hotPosts.length" class="home-posts">
        <RouterLink v-for="post in hotPosts" :key="post.id" :to="`/community/${post.id}`"
          ><strong>{{ post.title || post.nickname || '社区动态' }}</strong>
          <p>{{ post.content }}</p>
          <span>♥ {{ post.likeCount }} · 评论 {{ post.replyCount }}</span></RouterLink
        >
      </div>
      <p v-else class="state-message">{{ community.error || '社区暂时没有动态' }}</p>
    </section>
  </div>
</template>
