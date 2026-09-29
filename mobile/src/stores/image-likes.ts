import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ContentItem } from '../types/content';
import {
  contentCoverLikeTarget,
  fetchImageLikeSummaries,
  fetchImageLikeTargetSummaries,
  toggleContentImageLike,
  type ImageLikeTarget,
  type ImageLikeSummary
} from '../services/image-likes';
import { getSupabase } from '../services/supabase';
import { useAuthStore } from './auth';

export const useImageLikesStore = defineStore('image-likes', () => {
  const summaries = ref<Record<string, ImageLikeSummary>>({});
  const pending = ref<Record<string, boolean>>({});

  function get(item: ContentItem): ImageLikeSummary {
    const target = contentCoverLikeTarget(item);
    return (target && summaries.value[target.imageKey]) || { count: 0, liked: false };
  }

  function isPending(item: ContentItem): boolean {
    const target = contentCoverLikeTarget(item);
    return Boolean(target && pending.value[target.imageKey]);
  }

  function getTarget(target: ImageLikeTarget): ImageLikeSummary {
    return summaries.value[target.imageKey] || { count: 0, liked: false };
  }

  function isTargetPending(target: ImageLikeTarget): boolean {
    return Boolean(pending.value[target.imageKey]);
  }

  async function load(items: ContentItem[]): Promise<void> {
    const rows = await fetchImageLikeSummaries(await getSupabase(), items);
    summaries.value = {
      ...summaries.value,
      ...Object.fromEntries(rows)
    };
  }

  async function loadTargets(targets: ImageLikeTarget[]): Promise<void> {
    const rows = await fetchImageLikeTargetSummaries(await getSupabase(), targets);
    summaries.value = { ...summaries.value, ...Object.fromEntries(rows) };
  }

  async function toggle(item: ContentItem): Promise<void> {
    const target = contentCoverLikeTarget(item);
    if (!target) return;
    await toggleTarget(target);
  }

  async function toggleTarget(target: ImageLikeTarget): Promise<void> {
    const auth = useAuthStore();
    if (!auth.user) throw new Error('AUTH_REQUIRED');
    if (pending.value[target.imageKey]) return;
    pending.value = { ...pending.value, [target.imageKey]: true };
    try {
      const summary = await toggleContentImageLike(await getSupabase(), target);
      summaries.value = { ...summaries.value, [target.imageKey]: summary };
    } finally {
      const next = { ...pending.value };
      delete next[target.imageKey];
      pending.value = next;
    }
  }

  return { summaries, pending, get, getTarget, isPending, isTargetPending, load, loadTargets, toggle, toggleTarget };
});
