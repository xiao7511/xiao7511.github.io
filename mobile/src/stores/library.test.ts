import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchContent: vi.fn() }));
vi.mock('../services/content', () => ({ fetchContent: mocks.fetchContent }));

import { useAnimeStore } from './anime';
import { useMangaStore } from './manga';

describe('library store failure states', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.fetchContent.mockReset();
  });

  test.each([
    ['anime', useAnimeStore],
    ['manga', useMangaStore]
  ] as const)('%s network failure exits loading and exposes only the safe application message', async (_, useStore) => {
    mocks.fetchContent.mockRejectedValue(new Error('sensitive backend failure'));
    const store = useStore();
    await store.load();
    expect(store.loading).toBe(false);
    expect(store.error).toBeTruthy();
    expect(store.error).not.toContain('sensitive backend failure');
    expect(store.items).toEqual([]);
  });
});
