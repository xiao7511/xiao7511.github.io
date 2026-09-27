<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { contentImageUrl } from '../services/images';
import defaultAvatar from '../assets/nobi-avatar.svg';
const props = withDefaults(defineProps<{ src?: string | null; name?: string; size?: 'small' | 'large' }>(), {
  name: 'NOBI 用户',
  size: 'small'
});
const failed = ref(false);
const fallbackFailed = ref(false);
const sourceUrl = computed(() => contentImageUrl(props.src));
const url = computed(() => (failed.value || !sourceUrl.value ? defaultAvatar : sourceUrl.value));
function handleError(): void {
  if (url.value === defaultAvatar) fallbackFailed.value = true;
  else failed.value = true;
}
watch(
  () => props.src,
  () => {
    failed.value = false;
    fallbackFailed.value = false;
  }
);
</script>
<template>
  <span class="avatar" :class="`avatar--${size}`"
    ><img v-if="!fallbackFailed" :src="url" :alt="`${name}的头像`" loading="lazy" @error="handleError" /><span
      v-else
      aria-hidden="true"
      >N</span
    ></span
  >
</template>
