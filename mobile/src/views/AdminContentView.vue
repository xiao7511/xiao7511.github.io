<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import AdminContentImageEditor from '../components/AdminContentImageEditor.vue';
import ContentImage from '../components/ContentImage.vue';
import {
  deleteAdminHomeContent,
  fetchAdminHomeContent,
  saveAdminHomeContent,
  type HomeContentCategory
} from '../services/admin';
import { getSupabase } from '../services/supabase';
import { useToastStore } from '../stores/toast';
import type { ContentItem } from '../types/content';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const items = ref<ContentItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const editingId = ref('');
const editorBusy = ref(false);
const error = ref('');
const category = computed<HomeContentCategory>(() => (route.params.category === 'manga' ? 'manga' : 'anime'));
const title = computed(() => (category.value === 'anime' ? '本季热门' : '新番推荐'));
const activeCount = computed(() => items.value.filter((item) => item.is_active !== false).length);
const busy = computed(() => saving.value || editorBusy.value);

function toggleEditor(item: ContentItem): void {
  if (editingId.value === item.id) {
    editingId.value = '';
    return;
  }
  editingId.value = item.id;
}

function updateItem(updated: ContentItem): void {
  const index = items.value.findIndex((item) => item.id === updated.id);
  if (index >= 0) items.value[index] = updated;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  editingId.value = '';
  try {
    items.value = await fetchAdminHomeContent(await getSupabase(), category.value);
  } catch {
    error.value = `${title.value}加载失败。`;
  } finally {
    loading.value = false;
  }
}

function move(index: number, direction: -1 | 1): void {
  const next = index + direction;
  if (next < 0 || next >= items.value.length) return;
  [items.value[index], items.value[next]] = [items.value[next], items.value[index]];
}

function toggle(item: ContentItem): void {
  if (item.is_active === false && activeCount.value >= 6) {
    toast.show('首页最多启用 6 条内容', 'error');
    return;
  }
  item.is_active = item.is_active === false;
}

async function save(): Promise<void> {
  if (busy.value) return;
  saving.value = true;
  try {
    await saveAdminHomeContent(await getSupabase(), category.value, items.value);
    items.value.forEach((item, index) => (item.slot_index = index));
    toast.show(`${title.value}已保存`, 'success');
  } catch {
    toast.show('保存失败，请检查内容数量和管理员权限', 'error');
  } finally {
    saving.value = false;
  }
}

async function remove(item: ContentItem): Promise<void> {
  if (!globalThis.confirm(`确定永久删除“${item.title}”吗？`)) return;
  try {
    await deleteAdminHomeContent(await getSupabase(), category.value, item.id);
    items.value = items.value.filter((entry) => entry.id !== item.id);
    await save();
  } catch {
    toast.show('删除失败', 'error');
  }
}

watch(category, load);
onMounted(load);
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">‹</button>
      <h1>{{ title }}</h1>
      <span aria-hidden="true"></span>
    </header>
    <p class="admin-section-note">启用 {{ activeCount }}/6 · 使用上下按钮调整 Web 与 Mobile 共用顺序</p>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <div v-else class="admin-list">
      <article v-for="(item, index) in items" :key="item.id" class="admin-content-card">
        <div class="admin-image-preview admin-image-preview--cover">
          <ContentImage :src="item.cover_url" :alt="item.title" />
        </div>
        <div>
          <strong>{{ item.title }}</strong>
          <small>排序 {{ index + 1 }} · {{ item.is_active === false ? '已停用' : '展示中' }}</small>
        </div>
        <button type="button" class="admin-edit-content-button" :disabled="busy" @click="toggleEditor(item)">
          {{ editingId === item.id ? '收起内容管理' : '编辑内容' }}
        </button>
        <AdminContentImageEditor
          v-if="editingId === item.id"
          :item="item"
          @updated="updateItem"
          @busy="editorBusy = $event"
        />
        <div class="admin-content-actions">
          <button type="button" :disabled="index === 0 || busy" aria-label="上移" @click="move(index, -1)">↑</button>
          <button
            type="button"
            :disabled="index === items.length - 1 || busy"
            aria-label="下移"
            @click="move(index, 1)"
          >
            ↓
          </button>
          <button type="button" :disabled="busy" @click="toggle(item)">
            {{ item.is_active === false ? '加入展示' : '停用' }}
          </button>
          <button type="button" class="danger" :disabled="busy" @click="remove(item)">删除</button>
        </div>
      </article>
      <p v-if="!items.length" class="admin-empty">当前没有可管理内容，请先通过现有 Web 内容后台创建作品。</p>
      <button type="button" class="admin-save-button" :disabled="busy" @click="save">
        {{ saving ? '保存中…' : '保存排序与状态' }}
      </button>
    </div>
  </div>
</template>
