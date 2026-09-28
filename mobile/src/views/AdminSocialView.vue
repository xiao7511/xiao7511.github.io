<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import { fetchAdminSocialLinks, saveAdminSocialLinks } from '../services/admin';
import { isValidSocialUrl, type SocialSetting } from '../services/social-links';
import { getSupabase } from '../services/supabase';
import { useToastStore } from '../stores/toast';

const router = useRouter();
const toast = useToastStore();
const settings = ref<SocialSetting[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    settings.value = await fetchAdminSocialLinks(await getSupabase());
  } catch {
    error.value = '社媒配置加载失败。';
  } finally {
    loading.value = false;
  }
}

function move(index: number, direction: -1 | 1): void {
  const next = index + direction;
  if (next < 0 || next >= settings.value.length) return;
  [settings.value[index], settings.value[next]] = [settings.value[next], settings.value[index]];
  settings.value.forEach((item, order) => (item.order = order));
}

async function save(): Promise<void> {
  const invalid = settings.value.find((item) => !isValidSocialUrl(item.url));
  if (invalid) {
    toast.show(`${invalid.label} URL 格式无效`, 'error');
    return;
  }
  saving.value = true;
  try {
    await saveAdminSocialLinks(await getSupabase(), settings.value);
    toast.show('社媒配置已保存', 'success');
  } catch {
    toast.show('社媒配置保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>社媒维护</h1>
      <span aria-hidden="true"></span>
    </header>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <div v-else class="admin-list">
      <article v-for="(item, index) in settings" :key="item.key" class="admin-social-card">
        <div class="admin-card-heading">
          <strong>{{ item.label }}</strong
          ><small>排序 {{ index + 1 }}</small>
        </div>
        <label>URL<input v-model.trim="item.url" type="url" inputmode="url" placeholder="https://" /></label>
        <label class="admin-switch"><input v-model="item.enabled" type="checkbox" />启用</label>
        <div class="admin-content-actions">
          <button type="button" :disabled="index === 0" @click="move(index, -1)">上移</button>
          <button type="button" :disabled="index === settings.length - 1" @click="move(index, 1)">下移</button>
        </div>
      </article>
      <button type="button" class="admin-save-button" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存社媒配置' }}
      </button>
    </div>
  </div>
</template>
