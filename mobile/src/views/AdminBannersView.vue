<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdminContentImageEditor from '../components/AdminContentImageEditor.vue';
import AppError from '../components/AppError.vue';
import AppLoading from '../components/AppLoading.vue';
import ContentImage from '../components/ContentImage.vue';
import { useToastStore } from '../stores/toast';
import { fetchAdminBanners, fetchAdminLinkableContent, updateAdminBanner } from '../services/admin';
import { saveAdminContentImage, validateContentImage, type AdminImageSaveStage } from '../services/admin-image';
import { getSupabase } from '../services/supabase';
import type { ContentItem } from '../types/content';

const router = useRouter();
const toast = useToastStore();
const banners = ref<ContentItem[]>([]);
const content = ref<ContentItem[]>([]);
const loading = ref(true);
const error = ref('');
const pendingId = ref('');
const pendingStage = ref<AdminImageSaveStage | 'saving-metadata' | ''>('');
const editingBannerId = ref('');
const linkedEditorBusy = ref(false);
type AdminImageFile = Parameters<typeof saveAdminContentImage>[2];
const selectedFiles = ref<Record<string, AdminImageFile>>({});
const previewUrls = ref<Record<string, string>>({});
const contentById = computed(() => new Map(content.value.map((item) => [item.id, item])));

function linkedContent(item: ContentItem): ContentItem | undefined {
  const linked = item.linked_content_id ? contentById.value.get(item.linked_content_id) : undefined;
  return linked && ['anime', 'manga'].includes(linked.category) ? linked : undefined;
}

function clearSelection(id: string): void {
  const url = previewUrls.value[id];
  if (url) globalThis.URL.revokeObjectURL(url);
  const nextFiles = { ...selectedFiles.value };
  const nextUrls = { ...previewUrls.value };
  delete nextFiles[id];
  delete nextUrls[id];
  selectedFiles.value = nextFiles;
  previewUrls.value = nextUrls;
}

function selectImage(item: ContentItem, event: unknown): void {
  const input = (event as { target: { files?: { [index: number]: AdminImageFile }; value: string } }).target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    validateContentImage(file);
    clearSelection(item.id);
    selectedFiles.value = { ...selectedFiles.value, [item.id]: file };
    previewUrls.value = { ...previewUrls.value, [item.id]: globalThis.URL.createObjectURL(file) };
  } catch (cause) {
    toast.show(cause instanceof Error && cause.message === 'INVALID_CONTENT_IMAGE_SIZE' ? '图片须小于 10MB' : '仅支持 JPG、PNG、WebP 图片', 'error');
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const client = await getSupabase();
    [banners.value, content.value] = await Promise.all([
      fetchAdminBanners(client),
      fetchAdminLinkableContent(client)
    ]);
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
    const changes = {
      title: item.title,
      subtitle: item.subtitle,
      slot_index: item.slot_index,
      linked_content_id: item.linked_content_id || null
    };
    const file = selectedFiles.value[item.id];
    if (file) {
      item.cover_url = await saveAdminContentImage(await getSupabase(), item, file, changes, (stage) => {
        pendingStage.value = stage;
      });
      clearSelection(item.id);
    } else {
      pendingStage.value = 'saving-metadata';
      await updateAdminBanner(await getSupabase(), item.id, changes);
    }
    banners.value.sort((a, b) => a.slot_index - b.slot_index);
    toast.show('首页 Banner 已保存', 'success');
  } catch (cause) {
    toast.show(`Banner 保存失败：${cause instanceof Error ? cause.message : '请稍后重试'}`, 'error');
  } finally {
    pendingId.value = '';
    pendingStage.value = '';
  }
}

function toggleLinkedEditor(item: ContentItem): void {
  if (!linkedContent(item) || pendingId.value || linkedEditorBusy.value) return;
  editingBannerId.value = editingBannerId.value === item.id ? '' : item.id;
}

function updateLinked(updated: ContentItem): void {
  const index = content.value.findIndex((item) => item.id === updated.id);
  if (index >= 0) content.value[index] = updated;
}

onMounted(load);
onBeforeUnmount(() => Object.values(previewUrls.value).forEach((url) => globalThis.URL.revokeObjectURL(url)));
</script>

<template>
  <div class="page admin-page">
    <header class="admin-topbar">
      <button type="button" class="header-action" aria-label="返回" @click="router.back">←</button>
      <h1>Banner 管理</h1><span aria-hidden="true"></span>
    </header>
    <AppLoading v-if="loading" />
    <AppError v-else-if="error" :message="error" @retry="load" />
    <div v-else class="admin-list">
      <article v-for="item in banners" :key="item.id" class="admin-banner-card">
        <section class="admin-editor-section">
          <div class="admin-editor-section-title"><h3>首页展示</h3><small>独立于主题封面</small></div>
          <div class="admin-image-preview">
            <img v-if="previewUrls[item.id]" :src="previewUrls[item.id]" :alt="`${item.title} Banner 上传前预览`" />
            <ContentImage v-else :src="item.cover_url" :alt="`${item.title} 首页 Banner`" />
          </div>
          <label class="admin-image-picker">
            <span>{{ selectedFiles[item.id] ? '重新选择 Banner 图片' : '选择 / 更换 Banner 图片' }}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="Boolean(pendingId) || linkedEditorBusy" @change="selectImage(item, $event)" />
          </label>
          <small v-if="selectedFiles[item.id]" class="admin-image-filename">上传前预览：{{ selectedFiles[item.id].name }}</small>
          <label>标题<input v-model.trim="item.title" maxlength="120" /></label>
          <label>副标题<input v-model.trim="item.subtitle" maxlength="180" /></label>
          <label>排序<input v-model.number="item.slot_index" type="number" min="0" max="20" /></label>
        </section>

        <section class="admin-editor-section">
          <div class="admin-editor-section-title"><h3>关联主题</h3><small>{{ linkedContent(item)?.category === 'anime' ? 'Anime' : linkedContent(item)?.category === 'manga' ? 'Manga' : '未关联' }}</small></div>
          <label>
            主题
            <select v-model="item.linked_content_id" :disabled="Boolean(pendingId) || linkedEditorBusy">
              <option :value="null">未关联主题内容</option>
              <optgroup label="Anime">
                <option v-for="entry in content.filter((row) => row.category === 'anime')" :key="entry.id" :value="entry.id">{{ entry.title }}</option>
              </optgroup>
              <optgroup label="Manga">
                <option v-for="entry in content.filter((row) => row.category === 'manga')" :key="entry.id" :value="entry.id">{{ entry.title }}</option>
              </optgroup>
            </select>
          </label>
          <p v-if="linkedContent(item)" class="admin-section-note">关联主题：{{ linkedContent(item)?.title }}</p>
          <p v-else class="admin-gallery-empty">未关联主题内容</p>
        </section>

        <button type="button" :disabled="Boolean(pendingId) || linkedEditorBusy" @click="save(item)">
          {{ pendingId === item.id ? (pendingStage === 'uploading' ? '上传中…' : '保存中…') : '保存首页 Banner' }}
        </button>
        <button type="button" class="admin-edit-content-button" :disabled="!linkedContent(item) || Boolean(pendingId) || linkedEditorBusy" @click="toggleLinkedEditor(item)">
          {{ editingBannerId === item.id ? '收起关联主题内容' : '编辑关联主题内容' }}
        </button>
        <AdminContentImageEditor
          v-if="editingBannerId === item.id && linkedContent(item)"
          :item="linkedContent(item)!"
          @updated="updateLinked"
          @busy="linkedEditorBusy = $event"
        />
      </article>
    </div>
  </div>
</template>
