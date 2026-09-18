import { describe, expect, test } from 'vitest';
import { groupLikesByPostId } from '../public/assets/js/src/community/posts.js';
import { togglePostLike } from '../public/assets/js/src/community/likes.js';

describe('community likes modules', () => {
  test('groups user ids by bigint post id', () => {
    const groups = groupLikesByPostId([
      { post_id: 10, user_id: 'user-a' },
      { post_id: 10, user_id: 'user-b' },
      { post_id: 11, user_id: 'user-a' }
    ]);
    expect(groups.get(10)).toEqual(['user-a', 'user-b']);
    expect(groups.get(11)).toEqual(['user-a']);
  });

  test('inserts using the verified auth user id', async () => {
    const calls = [];
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) },
      from: (table) => ({
        insert: (payload) => {
          calls.push({ table, payload });
          return Promise.resolve({ error: null });
        }
      })
    };
    const result = await togglePostLike(client, { postId: 42, isLiked: false });
    expect(result.authenticated).toBe(true);
    expect(calls).toEqual([{ table: 'post_likes', payload: { post_id: 42, user_id: 'verified-user' } }]);
  });

  test('deletes only the verified user reaction', async () => {
    const filters = [];
    const query = {
      eq(column, value) {
        filters.push([column, value]);
        return this;
      },
      then(resolve) {
        resolve({ error: null });
      }
    };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) },
      from: () => ({ delete: () => query })
    };
    await togglePostLike(client, { postId: 42, isLiked: true });
    expect(filters).toEqual([
      ['post_id', 42],
      ['user_id', 'verified-user']
    ]);
  });
});
