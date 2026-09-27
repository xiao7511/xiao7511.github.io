<script setup lang="ts">
import { useToastStore } from '../stores/toast';
const toast = useToastStore();
</script>
<template>
  <div class="toast-stack" aria-live="polite">
    <button
      v-for="message in toast.messages"
      :key="message.id"
      type="button"
      class="toast"
      :class="`toast--${message.kind}`"
      @click="toast.dismiss(message.id)"
    >
      {{ message.text }}
    </button>
  </div>
</template>
