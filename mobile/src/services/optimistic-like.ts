export interface LikeState {
  liked: boolean;
  likeCount: number;
}

export function optimisticLike(state: LikeState): LikeState {
  return {
    liked: !state.liked,
    likeCount: Math.max(0, state.likeCount + (state.liked ? -1 : 1))
  };
}

export async function runOptimisticLike(
  current: LikeState,
  apply: (state: LikeState) => void,
  mutate: (remove: boolean) => Promise<LikeState>
): Promise<void> {
  const optimistic = optimisticLike(current);
  apply(optimistic);
  try {
    apply(await mutate(current.liked));
  } catch (error) {
    apply(current);
    throw error;
  }
}
