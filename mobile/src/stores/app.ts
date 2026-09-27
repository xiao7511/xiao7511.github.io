import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const online = ref(navigator.onLine);
  const setOnline = () => {
    online.value = navigator.onLine;
  };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  return { online };
});
