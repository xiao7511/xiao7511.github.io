import { describe, expect, test, vi } from 'vitest';
import { runOptimisticLike, type LikeState } from './optimistic-like';

describe('optimistic like rollback', () => {
  test('rolls back when the mutation fails', async () => {
    const states: LikeState[] = [];
    await expect(
      runOptimisticLike(
        { liked: false, likeCount: 4 },
        (state) => states.push({ ...state }),
        vi.fn().mockRejectedValue(new Error('RLS'))
      )
    ).rejects.toThrow('RLS');
    expect(states).toEqual([
      { liked: true, likeCount: 5 },
      { liked: false, likeCount: 4 }
    ]);
  });
});
