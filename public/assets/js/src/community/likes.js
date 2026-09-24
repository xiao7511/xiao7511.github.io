import { getAuthenticatedSession, isAuthJwtError, refreshAuthenticatedSession } from '../auth/session.js';

async function mutatePostLike(client, { postId, isLiked, userId }) {
  if (typeof client.rpc === 'function') {
    return client.rpc('toggle_post_like', { p_post_id: postId, p_remove: isLiked });
  }
  const request = isLiked
    ? client.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    : client.from('post_likes').insert({ post_id: postId, user_id: userId });
  return request;
}

export async function togglePostLike(client, { postId, isLiked }) {
  let authState = await getAuthenticatedSession(client);
  if (!authState.session) return { authenticated: false, reason: 'expired' };

  let result = await mutatePostLike(client, {
    postId,
    isLiked,
    userId: authState.session.user.id
  });

  if (result.error && isAuthJwtError(result.error) && !authState.refreshed) {
    authState = await refreshAuthenticatedSession(client);
    if (!authState.session) return { authenticated: false, reason: 'expired' };
    result = await mutatePostLike(client, {
      postId,
      isLiked,
      userId: authState.session.user.id
    });
  }

  if (result.error) {
    if (isAuthJwtError(result.error)) return { authenticated: false, reason: 'expired' };
    throw result.error;
  }

  return { authenticated: true, user: authState.session.user };
}
