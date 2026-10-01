import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { addReply, fetchCommunityPost } from '../services/community';
import { getSupabase } from '../services/supabase';
import type { CommunityPost } from '../types/community';
import { useCommunityStore } from './community';

vi.mock('../services/community', () => ({
  addPost: vi.fn(),
  addReply: vi.fn(),
  fetchCommunityPage: vi.fn(),
  fetchCommunityPost: vi.fn(),
  reportPost: vi.fn(),
  setUserBlock: vi.fn(),
  togglePostLike: vi.fn()
}));

vi.mock('../services/supabase', () => ({ getSupabase: vi.fn() }));

function post(id: number): CommunityPost {
  return {
    id,
    user_id: 'author',
    created_at: '2026-01-01T00:00:00Z',
    content: `post ${id}`,
    nickname: null,
    avatar_url: null,
    title: null,
    category: null,
    parent_id: null,
    likeCount: 0,
    replyCount: 0,
    liked: false
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('community store request reliability', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test('keeps the newest selected post when an earlier request finishes later', async () => {
    const first = deferred<{ post: CommunityPost; replies: [] }>();
    const second = deferred<{ post: CommunityPost; replies: [] }>();
    vi.mocked(fetchCommunityPost).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = useCommunityStore();

    const firstLoad = store.loadPost(1);
    const secondLoad = store.loadPost(2);
    second.resolve({ post: post(2), replies: [] });
    await secondLoad;
    first.resolve({ post: post(1), replies: [] });
    await firstLoad;

    expect(store.selected?.id).toBe(2);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  test('rejects invalid post ids without querying the backend', async () => {
    const store = useCommunityStore();
    await store.loadPost(0);

    expect(fetchCommunityPost).not.toHaveBeenCalled();
    expect(store.selected).toBeNull();
    expect(store.replies).toEqual([]);
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test('rejects unsafe integer post ids without querying the backend', async () => {
    const store = useCommunityStore();
    await store.loadPost(Number.MAX_SAFE_INTEGER + 1);

    expect(fetchCommunityPost).not.toHaveBeenCalled();
    expect(store.selected).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeTruthy();
  });

  test('releases the like in-flight guard when Supabase initialization fails', async () => {
    const store = useCommunityStore();
    store.posts = [post(7)];
    vi.mocked(getSupabase).mockRejectedValue(new Error('client unavailable'));

    await expect(store.toggleLike(7, { access_token: 'token' } as never)).rejects.toThrow('client unavailable');

    expect(store.pendingLikes[7]).toBe(false);
    expect(store.posts[0]).toMatchObject({ liked: false, likeCount: 0 });
  });

  test('does not refresh an old post after its reply finishes on a newer route', async () => {
    let finishReply!: () => void;
    vi.mocked(getSupabase).mockResolvedValue({} as never);
    vi.mocked(addReply).mockImplementation(
      () => new Promise<void>((resolve) => { finishReply = resolve; })
    );
    vi.mocked(fetchCommunityPost).mockResolvedValue({ post: post(2), replies: [] });
    const store = useCommunityStore();
    store.selected = post(1);

    const reply = store.reply(1, 'reply', { user: { id: 'author' } } as never, null);
    await vi.waitFor(() => expect(addReply).toHaveBeenCalledOnce());
    await store.loadPost(2);
    finishReply();
    await reply;

    expect(store.selected?.id).toBe(2);
    expect(fetchCommunityPost).toHaveBeenCalledTimes(1);
    expect(fetchCommunityPost).toHaveBeenCalledWith(2);
  });
});
