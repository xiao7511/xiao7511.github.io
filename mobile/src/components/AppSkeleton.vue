<script setup lang="ts">
withDefaults(defineProps<{ count?: number; variant?: 'card' | 'post' }>(), { count: 4, variant: 'card' });
</script>
<template>
  <div :class="variant === 'card' ? 'card-grid' : 'feed-list'" aria-label="正在加载">
    <div v-for="index in count" :key="index" :class="`${variant}-skeleton`"></div>
  </div>
</template>
