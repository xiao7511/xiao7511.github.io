<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import AppAvatar from '../components/AppAvatar.vue';
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
async function logout(): Promise<void> {
  try {
    await auth.signOut();
    toast.show('已退出登录', 'success');
    await router.replace('/');
  } catch {
    toast.show(auth.error || '退出失败', 'error');
  }
}
</script>
<template>
  <div class="page listing-page">
    <div class="page-heading">
      <span class="eyebrow">ACCOUNT</span>
      <h1>我的</h1>
      <p>你的 NOBI 空间</p>
    </div>
    <div v-if="auth.user" class="profile-card profile-card--aligned">
      <div class="profile-cover" aria-hidden="true"></div>
      <AppAvatar
        :src="auth.profile?.avatar_url"
        :name="auth.profile?.nickname || auth.user.email || '用户'"
        size="large"
      />
      <h2>{{ auth.profile?.nickname || auth.user.email?.split('@')[0] }}</h2>
      <p>{{ auth.user.email }}</p>
      <dl>
        <div>
          <dt>账号 ID</dt>
          <dd>{{ auth.user.id }}</dd>
        </div>
      </dl>
      <nav class="profile-menu" aria-label="账号功能">
        <RouterLink to="/community">我的帖子与社区</RouterLink>
        <RouterLink to="/privacy">隐私与设置</RouterLink>
        <RouterLink to="/support">消息与支持</RouterLink>
      </nav>
      <button class="secondary-button" type="button" :disabled="auth.loading" @click="logout">退出登录</button>
      <RouterLink to="/account/delete" class="profile-danger-link">删除账号</RouterLink>
    </div>
    <div v-else class="profile-card profile-card--guest">
      <AppAvatar size="large" name="NOBI" />
      <h2>欢迎来到 NOBI</h2>
      <p>登录后参与社区讨论与点赞。</p>
      <div class="button-row">
        <RouterLink to="/login" class="primary-button">登录</RouterLink
        ><RouterLink to="/register" class="secondary-button">注册</RouterLink>
      </div>
    </div>
    <nav class="profile-links" aria-label="支持与政策">
      <RouterLink to="/privacy">隐私政策</RouterLink>
      <RouterLink to="/support">支持与联系</RouterLink>
    </nav>
  </div>
</template>
