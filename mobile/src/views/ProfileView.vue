<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
</script>

<template>
  <div class="page listing-page"><div class="page-heading"><span class="eyebrow">ACCOUNT</span><h1>我的</h1><p>你的 NOBI 空间</p></div>
    <div class="coming-panel"><span aria-hidden="true">◉</span><h2 v-if="auth.user">{{ auth.user.email || '已登录' }}</h2><h2 v-else>欢迎来到 NOBI</h2><p v-if="auth.error">{{ auth.error }}</p><p v-else-if="!auth.ready">正在检查登录状态…</p><p v-else>账号与收藏体验将在下一阶段上线。</p></div>
  </div>
</template>
