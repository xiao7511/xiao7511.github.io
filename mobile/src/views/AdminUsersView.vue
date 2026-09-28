<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppAvatar from '../components/AppAvatar.vue';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { fetchAdminUsers, setAdminState, type AdminUser } from '../services/admin';
import { getSupabase } from '../services/supabase';

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();
const users = ref<AdminUser[]>([]);
const loading = ref(true);
const error = ref('');
const pendingId = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    users.value = await fetchAdminUsers(await getSupabase());
  } catch {
    error.value = '用户列表加载失败，请确认生产 users 读取策略。';
  } finally {
    loading.value = false;
  }
}

async function toggle(user: AdminUser): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = user.id;
  try {
    await setAdminState(await getSupabase(), user.id, !user.is_admin);
    user.is_admin = !user.is_admin;
    if (user.id === auth.user?.id) await auth.refreshSession();
    toast.show('管理员权限已更新', 'success');
  } catch {
    toast.show('权限更新失败', 'error');
  } finally {
    pendingId.value = '';
  }
}

onMounted(load);
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>用户管理</h1>
      <span aria-hidden="true"></span>
    </header>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <div v-else class="admin-list">
      <article v-for="user in users" :key="user.id" class="admin-user-card">
        <AppAvatar :src="user.avatar_url" :user-id="user.id" :name="user.nickname || user.email || '用户'" />
        <div>
          <strong>{{ user.nickname || '未设置昵称' }}</strong>
          <span>{{ user.email || '未提供邮箱' }}</span>
          <small>注册：{{ user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '—' }}</small>
        </div>
        <button type="button" :disabled="Boolean(pendingId)" @click="toggle(user)">
          {{ user.is_admin ? '取消管理员' : '设为管理员' }}
        </button>
      </article>
    </div>
  </div>
</template>
