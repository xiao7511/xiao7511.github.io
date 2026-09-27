import type { SupportedStorage } from '@supabase/supabase-js';

export interface SessionStorageAdapter extends SupportedStorage {
  readonly kind: 'web';
}

export function createSessionStorage(storage: Storage = globalThis.localStorage): SessionStorageAdapter {
  return {
    kind: 'web',
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key)
  };
}
