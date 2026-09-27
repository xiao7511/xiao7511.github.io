import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchContent } from '../services/content';
import type { ContentItem } from '../types/content';

export const useAnimeStore = defineStore('anime', () => {
  const items = ref<ContentItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try { items.value = await fetchContent('recommend'); }
    catch { error.value = '动漫内容加载失败，请检查网络后重试。'; }
    finally { loading.value = false; }
  }
  return { items, loading, error, load };
});
