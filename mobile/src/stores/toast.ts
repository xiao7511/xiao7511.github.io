import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', () => {
  const messages = ref<ToastMessage[]>([]);
  let nextId = 1;
  function show(text: string, kind: ToastMessage['kind'] = 'info'): void {
    const id = nextId++;
    messages.value.push({ id, text, kind });
    globalThis.setTimeout(() => dismiss(id), 3200);
  }
  function dismiss(id: number): void {
    messages.value = messages.value.filter((item) => item.id !== id);
  }
  return { messages, show, dismiss };
});
