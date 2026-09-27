<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { contentImageUrl } from '../services/images';

const props = defineProps<{ src?: string | null; alt: string }>();
const failed = ref(false);
const loaded = ref(false);
const url = computed(() => contentImageUrl(props.src));
watch(
  () => props.src,
  () => {
    failed.value = false;
    loaded.value = false;
  }
);
</script>

<template>
  <div class="content-image" :class="{ 'is-loading': !loaded && !!url && !failed }">
    <img
      v-if="url && !failed"
      :src="url"
      :alt="alt"
      loading="lazy"
      decoding="async"
      @load="loaded = true"
      @error="failed = true"
    />
    <div v-else class="image-fallback" role="img" :aria-label="alt"><span>N</span><small>暂无封面</small></div>
  </div>
</template>
