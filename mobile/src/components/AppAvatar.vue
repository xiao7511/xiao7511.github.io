<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { contentImageUrl } from '../services/images';
const props = withDefaults(defineProps<{ src?: string | null; name?: string; size?: 'small' | 'large' }>(), {
  name: 'NOBI 用户',
  size: 'small'
});
const failed = ref(false);
const url = computed(() => contentImageUrl(props.src));
watch(
  () => props.src,
  () => {
    failed.value = false;
  }
);
</script>
<template>
  <span class="avatar" :class="`avatar--${size}`"
    ><img v-if="url && !failed" :src="url" :alt="`${name}的头像`" loading="lazy" @error="failed = true" /><span
      v-else
      aria-hidden="true"
      >N</span
    ></span
  >
</template>
