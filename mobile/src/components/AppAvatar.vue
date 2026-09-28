<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { contentImageUrl } from '../services/images';
import defaultAvatar from '../assets/nobi-avatar.svg';
import { useAuthStore } from '../stores/auth';
const props = withDefaults(
  defineProps<{ src?: string | null; userId?: string | null; name?: string; size?: 'small' | 'large' }>(),
  {
    name: 'NOBI 用户',
    size: 'small'
  }
);
const failed = ref(false);
const fallbackFailed = ref(false);
const auth = useAuthStore();
const liveSource = computed(() =>
  props.userId && props.userId === auth.user?.id ? auth.profile?.avatar_url : props.src
);
const sourceUrl = computed(() => contentImageUrl(liveSource.value));
const url = computed(() => (failed.value || !sourceUrl.value ? defaultAvatar : sourceUrl.value));
function handleError(): void {
  if (url.value === defaultAvatar) fallbackFailed.value = true;
  else failed.value = true;
}
watch(
  () => liveSource.value,
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
