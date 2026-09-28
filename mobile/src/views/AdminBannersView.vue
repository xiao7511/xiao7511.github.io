<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import ContentImage from '../components/ContentImage.vue';
import { useToastStore } from '../stores/toast';
import { fetchAdminBanners, updateAdminBanner } from '../services/admin';
import { getSupabase } from '../services/supabase';
import type { ContentItem } from '../types/content';

const router = useRouter();
const toast = useToastStore();
const banners = ref<ContentItem[]>([]);
const loading = ref(true);
const error = ref('');
const pendingId = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    banners.value = await fetchAdminBanners(await getSupabase());
  } catch {
    error.value = 'Banner 加载失败。';
  } finally {
    loading.value = false;
  }
}

async function save(item: ContentItem): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = item.id;
  try {
    await updateAdminBanner(await getSupabase(), item.id, {
      title: item.title,
      subtitle: item.subtitle,
      slot_index: item.slot_index
    });
    banners.value.sort((a, b) => a.slot_index - b.slot_index);
    toast.show('Banner 已保存', 'success');
  } catch {
    toast.show('Banner 保存失败', 'error');
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
      <h1>Banner 管理</h1>
      <span aria-hidden="true"></span>
    </header>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <div v-else class="admin-list">
      <article v-for="item in banners" :key="item.id" class="admin-banner-card">
        <ContentImage :src="item.cover_url" :alt="item.title" />
        <label>标题<input v-model.trim="item.title" maxlength="120" /></label>
        <label>副标题<input v-model.trim="item.subtitle" maxlength="180" /></label>
        <label>排序<input v-model.number="item.slot_index" type="number" min="0" max="20" /></label>
        <button type="button" :disabled="Boolean(pendingId)" @click="save(item)">保存</button>
      </article>
    </div>
  </div>
</template>
