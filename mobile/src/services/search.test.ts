import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, test, vi } from 'vitest';
import { searchAll } from './search';

function queryWith(data: unknown[]) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data, error: null })
  };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function clientWith(content: unknown[], posts: unknown[] = [], profiles: unknown[] = []): SupabaseClient {
  const queries = {
    content_management: queryWith(content),
    posts: queryWith(posts),
    profiles: queryWith(profiles)
  };
  return { from: vi.fn((table: keyof typeof queries) => queries[table]) } as unknown as SupabaseClient;
}

function item(id: string, category: string, active: boolean | null) {
  return { id, category, slot_index: 1, title: 'Search Match', is_active: active };
}

describe('Mobile search content consistency', () => {
  test('returns active Anime and Manga content on canonical categories', async () => {
    const result = await searchAll(
      'search',
      clientWith([item('anime-active', 'anime', true), item('manga-active', 'manga', true)])
    );
    expect(result.content.map(({ category, id }) => `/${category}/${id}`)).toEqual([
      '/anime/anime-active',
      '/manga/manga-active'
    ]);
  });

  test('excludes is_active=false content before it can produce navigation', async () => {
    const result = await searchAll('search', clientWith([item('anime-disabled', 'anime', false)]));
    expect(result.content).toEqual([]);
  });

  test('keeps legacy is_active=null content compatible', async () => {
    const result = await searchAll('search', clientWith([item('legacy', 'anime', null)]));
    expect(result.content.map((entry) => entry.id)).toEqual(['legacy']);
  });

  test('rejects unsupported content categories even if the backend returns one', async () => {
    const result = await searchAll('search', clientWith([item('unsupported', 'banner', true)]));
    expect(result.content).toEqual([]);
  });

  test('reuses canonical identity, ordering, deduplication and NFKC matching', async () => {
    const result = await searchAll(
      'search match',
      clientWith([
        { ...item('z', 'anime', true), slot_index: 1, title: 'ＳＥＡＲＣＨ ＭＡＴＣＨ' },
        { ...item('a', 'anime', null), slot_index: 0 },
        { ...item('a', 'anime', true), slot_index: 3 },
        { ...item('', 'anime', true) },
        { ...item('bad-slot', 'anime', true), slot_index: -1 }
      ])
    );
    expect(result.content.map(({ id }) => id)).toEqual(['a', 'z']);
  });

  test('does not apply content active-state filtering to posts or users', async () => {
    const result = await searchAll(
      'search',
      clientWith(
        [],
        [{ id: 1, title: 'Search post', content: 'text', nickname: 'author', is_active: false }],
        [{ id: 'user-1', nickname: 'Search user', avatar_url: null, is_active: false }]
      )
    );
    expect(result.posts.map((post) => post.id)).toEqual([1]);
    expect(result.users.map((user) => user.id)).toEqual(['user-1']);
  });
});
