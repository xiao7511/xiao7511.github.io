<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { safeInternalPath } from '../router/safe-navigation';
const auth = useAuthStore();
const toast = useToastStore();
const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
function destination(): string {
  return safeInternalPath(route.query.redirect, '/profile');
}
async function submit(): Promise<void> {
  try {
    await auth.signIn(email.value.trim(), password.value);
    toast.show('登录成功', 'success');
    await router.replace(destination());
  } catch {
    toast.show(auth.error || '登录失败', 'error');
  }
}
</script>
<template>
  <div class="auth-page">
    <div class="auth-card">
      <RouterLink to="/" class="auth-logo"><span>N</span>NOBI 动漫</RouterLink><span class="eyebrow">WELCOME BACK</span>
      <h1>欢迎回来</h1>
      <p>登录后参与讨论和点赞。</p>
      <form @submit.prevent="submit">
        <label>邮箱<input v-model="email" type="email" autocomplete="email" inputmode="email" required /></label
        ><label>密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <p v-if="auth.error" class="form-error" role="alert">{{ auth.error }}</p>
        <button class="primary-button" type="submit" :disabled="auth.loading">
          {{ auth.loading ? '正在登录…' : '登录' }}
        </button>
      </form>
      <RouterLink :to="{ name: 'register', query: route.query }" class="auth-link">还没有账号？注册</RouterLink>
    </div>
  </div>
</template>
