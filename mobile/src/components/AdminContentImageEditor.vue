<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ContentImage from './ContentImage.vue';
import {
  saveAdminContentImage,
  saveAdminDetailGallery,
  validateContentImage,
  type AdminGalleryDraftEntry,
  type AdminImageSaveStage
} from '../services/admin-image';
import { getSupabase } from '../services/supabase';
import { useToastStore } from '../stores/toast';
import type { ContentItem } from '../types/content';

const props = defineProps<{ item: ContentItem }>();
const emit = defineEmits<{ updated: [item: ContentItem]; busy: [value: boolean] }>();
const toast = useToastStore();
type AdminImageFile = Parameters<typeof saveAdminContentImage>[2];
interface GalleryEditorEntry {
  key: string;
  existingUrl?: string;
  file?: AdminImageFile;
  previewUrl?: string;
}

const selectedFile = ref<AdminImageFile>();
const coverPreview = ref('');
const galleryDraft = ref<GalleryEditorEntry[]>([]);
const pendingImageStage = ref<AdminImageSaveStage | ''>('');
const pendingGalleryStage = ref<AdminImageSaveStage | ''>('');
const pendingGalleryProgress = ref('');
const busy = computed(() => Boolean(pendingImageStage.value || pendingGalleryStage.value));

function revokeCoverPreview(): void {
  if (coverPreview.value) globalThis.URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = '';
}

function revokeGalleryPreviews(): void {
  galleryDraft.value.forEach((entry) => {
    if (entry.previewUrl) globalThis.URL.revokeObjectURL(entry.previewUrl);
  });
}

function reset(detailUrls = props.item.detail_urls ?? []): void {
  revokeCoverPreview();
  selectedFile.value = undefined;
  revokeGalleryPreviews();
  galleryDraft.value = detailUrls.map((url) => ({
    key: globalThis.crypto.randomUUID(),
    existingUrl: url
  }));
}

function imageError(cause: unknown): void {
  toast.show(
    cause instanceof Error && cause.message === 'INVALID_CONTENT_IMAGE_SIZE'
      ? '图片须小于 10MB'
      : '仅支持 JPG、PNG、WebP 图片',
    'error'
  );
}

function selectCover(event: unknown): void {
  const input = (event as { target: { files?: { [index: number]: AdminImageFile }; value: string } }).target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    validateContentImage(file);
    revokeCoverPreview();
    selectedFile.value = file;
    coverPreview.value = globalThis.URL.createObjectURL(file);
  } catch (cause) {
    imageError(cause);
  }
}

async function saveCover(): Promise<void> {
  if (!selectedFile.value || busy.value) return;
  pendingImageStage.value = 'uploading';
  try {
    const coverUrl = await saveAdminContentImage(
      await getSupabase(),
      props.item,
      selectedFile.value,
      {},
      (stage) => (pendingImageStage.value = stage)
    );
    revokeCoverPreview();
    selectedFile.value = undefined;
    emit('updated', { ...props.item, cover_url: coverUrl });
    toast.show(`${props.item.title} 封面已保存`, 'success');
  } catch (cause) {
    toast.show(`封面保存失败：${cause instanceof Error ? cause.message : '请稍后重试'}`, 'error');
  } finally {
    pendingImageStage.value = '';
  }
}

function selectGalleryImage(entryKey: string | null, event: unknown): void {
  const input = (event as { target: { files?: { [index: number]: AdminImageFile }; value: string } }).target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    validateContentImage(file);
    if (entryKey) {
      const index = galleryDraft.value.findIndex((entry) => entry.key === entryKey);
      if (index < 0) return;
      const previous = galleryDraft.value[index];
      if (previous.previewUrl) globalThis.URL.revokeObjectURL(previous.previewUrl);
      galleryDraft.value[index] = { ...previous, file, previewUrl: globalThis.URL.createObjectURL(file) };
    } else {
      galleryDraft.value.push({ key: globalThis.crypto.randomUUID(), file, previewUrl: globalThis.URL.createObjectURL(file) });
    }
  } catch (cause) {
    imageError(cause);
  }
}

function removeGalleryImage(entryKey: string): void {
  if (busy.value) return;
  const entry = galleryDraft.value.find((row) => row.key === entryKey);
  if (entry?.previewUrl) globalThis.URL.revokeObjectURL(entry.previewUrl);
  galleryDraft.value = galleryDraft.value.filter((row) => row.key !== entryKey);
}

function moveGalleryImage(index: number, direction: -1 | 1): void {
  if (busy.value) return;
  const next = index + direction;
  if (next < 0 || next >= galleryDraft.value.length) return;
  [galleryDraft.value[index], galleryDraft.value[next]] = [galleryDraft.value[next], galleryDraft.value[index]];
}

async function saveGallery(): Promise<void> {
  if (busy.value) return;
  pendingGalleryStage.value = 'saving';
  try {
    const entries: AdminGalleryDraftEntry[] = galleryDraft.value.map((entry) => ({
      existingUrl: entry.existingUrl,
      file: entry.file
    }));
    const detailUrls = await saveAdminDetailGallery(
      await getSupabase(),
      props.item,
      entries,
      (stage, current, total) => {
        pendingGalleryStage.value = stage;
        pendingGalleryProgress.value = stage === 'uploading' ? `${current}/${total}` : '';
      }
    );
    reset(detailUrls);
    emit('updated', { ...props.item, detail_urls: detailUrls });
    toast.show(`${props.item.title} 详情图集已保存`, 'success');
  } catch (cause) {
    toast.show(`详情图集保存失败：${cause instanceof Error ? cause.message : '请稍后重试'}`, 'error');
  } finally {
    pendingGalleryStage.value = '';
    pendingGalleryProgress.value = '';
  }
}

watch(() => props.item.id, () => reset(), { immediate: true });
watch(busy, (value) => emit('busy', value));
onBeforeUnmount(() => {
  emit('busy', false);
  revokeCoverPreview();
  revokeGalleryPreviews();
});
</script>

<template>
  <section class="admin-content-editor">
    <div class="admin-editor-heading">
      <strong>关联主题内容</strong>
      <small>{{ item.title }} · {{ item.category === 'anime' ? 'Anime' : 'Manga' }}</small>
    </div>
    <div class="admin-editor-section">
      <h3>详情封面</h3>
      <div class="admin-editor-cover-preview">
        <img v-if="coverPreview" :src="coverPreview" :alt="`${item.title} 新封面预览`" />
        <ContentImage v-else :src="item.cover_url" :alt="`${item.title} 当前封面`" />
      </div>
      <div class="admin-image-actions">
        <label class="admin-image-picker">
          <span>{{ selectedFile ? '重新选择封面' : '选择 / 更换封面' }}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectCover" />
        </label>
        <button type="button" :disabled="!selectedFile || busy" @click="saveCover">
          {{ pendingImageStage === 'uploading' ? '封面上传中…' : pendingImageStage ? '封面保存中…' : '保存封面' }}
        </button>
        <small v-if="selectedFile">新封面预览：{{ selectedFile.name }}</small>
      </div>
    </div>
    <div class="admin-editor-section">
      <div class="admin-editor-section-title"><h3>详情图集</h3><small>{{ galleryDraft.length }} 张</small></div>
      <div v-if="galleryDraft.length" class="admin-gallery-grid">
        <article v-for="(entry, index) in galleryDraft" :key="entry.key">
          <div class="admin-gallery-preview">
            <img v-if="entry.previewUrl" :src="entry.previewUrl" :alt="`${item.title} 详情图片 ${index + 1} 上传前预览`" />
            <ContentImage v-else :src="entry.existingUrl" :alt="`${item.title} 当前详情图片 ${index + 1}`" />
          </div>
          <small>图片 {{ index + 1 }}{{ entry.file ? ' · 待上传' : '' }}</small>
          <div class="admin-gallery-actions">
            <label class="admin-image-picker"><span>替换</span><input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectGalleryImage(entry.key, $event)" /></label>
            <button type="button" :disabled="busy" @click="removeGalleryImage(entry.key)">删除</button>
            <button type="button" :disabled="busy || index === 0" aria-label="详情图片上移" @click="moveGalleryImage(index, -1)">↑</button>
            <button type="button" :disabled="busy || index === galleryDraft.length - 1" aria-label="详情图片下移" @click="moveGalleryImage(index, 1)">↓</button>
          </div>
        </article>
      </div>
      <p v-else class="admin-gallery-empty">当前没有详情图片</p>
      <label class="admin-gallery-add"><span>＋ 添加详情图片</span><input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectGalleryImage(null, $event)" /></label>
      <button type="button" class="admin-gallery-save" :disabled="busy" @click="saveGallery">
        {{ pendingGalleryStage === 'uploading' ? `图集上传中 ${pendingGalleryProgress}` : pendingGalleryStage ? '图集保存中…' : '保存详情图集' }}
      </button>
    </div>
  </section>
</template>
