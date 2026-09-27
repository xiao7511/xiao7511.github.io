<script setup lang="ts">
defineProps<{ name: 'xiaohongshu' | 'weibo' | 'twitter' | 'instagram' }>();
</script>

<template>
  <svg v-if="name === 'twitter'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18.9 2h3.7l-8.1 9.2L24 22h-7.4l-5.8-7.6L4.1 22H.4l8.7-9.9L0 2h7.6l5.2 6.9L18.9 2Zm-1.3 18.1h2L6.5 3.8H4.4l13.2 16.3Z" />
  </svg>
  <svg v-else-if="name === 'instagram'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
  </svg>
  <svg v-else-if="name === 'weibo'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.7 10.2c-.5-.2-.8-.3-.5-.9.7-1.7.8-3.1 0-3.9-1.4-1.4-5.1.1-8.2 3.2 0 0-1 .9-.7-.4.5-1.7.4-3.2-.4-3.7-1.9-1.1-6.9 3.8-9 7.6-2.8 5.1.5 8.3 5.6 9 5.4.7 10.7-1.9 11.8-5.8.7-2.6-.2-4.1 1.4-5.1ZM9.3 19.4c-3.3.3-6.1-1.2-6.3-3.4-.2-2.2 2.3-4.2 5.6-4.5 3.3-.4 6.1 1.1 6.3 3.3.2 2.2-2.3 4.3-5.6 4.6Zm-1.2-5.8c-1.7.4-2.9 1.7-2.6 2.9.3 1.2 1.9 1.8 3.6 1.4 1.7-.5 2.9-1.8 2.6-3-.3-1.2-1.9-1.8-3.6-1.3Z" />
  </svg>
  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="3" width="20" height="18" rx="5" />
    <path class="social-icon__cut" d="M7 8h10v2H7zm0 4h7v2H7zm0 4h4v2H7z" />
  </svg>
</template>
