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
const confirmPassword = ref('');
const localError = ref('');
const confirmation = ref(false);
function destination(): string {
  return safeInternalPath(route.query.redirect, '/profile');
}
async function submit(): Promise<void> {
  localError.value = '';
  if (password.value.length < 8) {
    localError.value = '密码至少需要 8 个字符';
    return;
  }
  if (password.value !== confirmPassword.value) {
    localError.value = '两次输入的密码不一致';
    return;
  }
  try {
    const result = await auth.signUp(email.value.trim(), password.value);
    confirmation.value = result.confirmationRequired;
    if (confirmation.value) toast.show('请检查邮箱完成验证', 'success');
    else {
      toast.show('注册成功', 'success');
      await router.replace(destination());
    }
  } catch {
    toast.show(auth.error || '注册失败', 'error');
  }
}
</script>
<template>
  <div class="auth-page">
    <div class="auth-card">
      <RouterLink to="/" class="auth-logo"><span>N</span>NOBI 动漫</RouterLink
      ><template v-if="confirmation"
        ><span class="eyebrow">VERIFY EMAIL</span>
        <h1>检查你的邮箱</h1>
        <p>验证邮件已经发送。完成验证后返回 App 登录。</p>
        <RouterLink to="/login" class="primary-button">前往登录</RouterLink></template
      ><template v-else
        ><span class="eyebrow">JOIN NOBI</span>
        <h1>创建账号</h1>
        <p>注册后即可加入社区。</p>
        <form @submit.prevent="submit">
          <label>邮箱<input v-model="email" type="email" autocomplete="email" inputmode="email" required /></label
          ><label
            >密码<input v-model="password" type="password" autocomplete="new-password" minlength="8" required /></label
          ><label
            >确认密码<input
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
          /></label>
          <p v-if="localError || auth.error" class="form-error" role="alert">{{ localError || auth.error }}</p>
          <button class="primary-button" type="submit" :disabled="auth.loading">
            {{ auth.loading ? '正在注册…' : '注册' }}
          </button>
        </form>
        <RouterLink :to="{ name: 'login', query: route.query }" class="auth-link">已有账号？登录</RouterLink></template
      >
    </div>
  </div>
</template>
