<script setup lang="ts">
defineProps<{ title: string; message?: string }>();
</script>
<template>
  <div class="app-state app-state--panel">
    <span aria-hidden="true">◇</span>
    <h2>{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
  </div>
</template>
