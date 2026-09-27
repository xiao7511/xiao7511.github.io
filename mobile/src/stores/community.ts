import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useCommunityStore = defineStore('community', () => {
  const ready = ref(false);
  return { ready };
});
