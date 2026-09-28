<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { getSupabase } from '../services/supabase';
import { fetchAdminStats } from '../services/admin';

const router = useRouter();
const auth = useAuthStore();
const stats = ref<Record<string, unknown>>({});
const popularImages = computed(() =>
  Array.isArray(stats.value.popular_images)
    ? (stats.value.popular_images as Array<{ image_key?: string; title?: string; likes?: number }>)
    : []
);

onMounted(async () => {
  try {
    stats.value = await fetchAdminStats(await getSupabase());
  } catch {
    stats.value = {};
  }
});

const modules = [
  { to: '/admin/users', icon: '◎', title: '用户管理', description: '查看账号与管理员权限' },
  { to: '/admin/reports', icon: '⚑', title: '举报审核', description: '审核社区举报与内容状态' },
  { to: '/admin/banners', icon: '▣', title: 'Banner 管理', description: '管理 Web 与 Mobile 共用轮播' },
  { to: '/admin/content/anime', icon: '🔥', title: '本季热门', description: '管理动漫展示、顺序和状态' },
  { to: '/admin/content/manga', icon: '★', title: '新番推荐', description: '管理推荐展示、顺序和状态' },
  { to: '/admin/social', icon: '⌁', title: '社媒维护', description: '统一维护社媒链接和顺序' }
];
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>后台管理</h1>
      <span aria-hidden="true"></span>
    </header>
    <section class="admin-identity">
      <span>管理员</span>
      <strong>{{ auth.profile?.nickname || auth.user?.email?.split('@')[0] || 'NOBI Admin' }}</strong>
      <small>{{ auth.user?.email }}</small>
    </section>
    <section v-if="Object.keys(stats).length" class="admin-stats" aria-label="数据统计">
      <div>
        <strong>{{ stats.total_posts ?? '—' }}</strong
        ><span>社区帖子</span>
      </div>
      <div>
        <strong>{{ stats.today_views ?? '—' }}</strong
        ><span>今日访问</span>
      </div>
      <div>
        <strong>{{ stats.image_likes ?? '—' }}</strong
        ><span>图片点赞</span>
      </div>
      <div>
        <strong>{{ stats.today_image_likes ?? '—' }}</strong
        ><span>今日新增点赞</span>
      </div>
    </section>
    <section v-if="popularImages.length" class="admin-popular-images" aria-labelledby="popular-images-title">
      <h2 id="popular-images-title">点赞最高内容</h2>
      <ol>
        <li v-for="item in popularImages" :key="item.image_key">
          <span>{{ item.title || '未命名内容' }}</span
          ><strong>♥ {{ item.likes || 0 }}</strong>
        </li>
      </ol>
    </section>
    <nav class="admin-module-grid" aria-label="管理模块">
      <RouterLink v-for="item in modules" :key="item.to" :to="item.to">
        <span aria-hidden="true">{{ item.icon }}</span>
        <strong>{{ item.title }}</strong>
        <small>{{ item.description }}</small>
      </RouterLink>
    </nav>
  </div>
</template>
