<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'home'"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></template>
    <template v-else-if="name === 'anime'"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4z"/></template>
    <template v-else-if="name === 'manga'"><path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1z"/><path d="M12 6v14"/></template>
    <template v-else-if="name === 'community'"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 3V7a2 2 0 0 1 1-2z"/><path d="M8 10h8M8 14h6"/></template>
    <template v-else><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></template>
  </svg>
</template>
