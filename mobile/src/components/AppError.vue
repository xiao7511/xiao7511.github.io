<script setup lang="ts">
defineProps<{ message: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div class="app-state app-state--error" role="alert">
    <span aria-hidden="true">!</span>
    <p>{{ message }}</p>
    <button type="button" @click="$emit('retry')">重新加载</button>
  </div>
</template>
