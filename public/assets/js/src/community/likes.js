import { getVerifiedUser } from '../auth/session.js';

export async function togglePostLike(client, { postId, isLiked }) {
  const user = await getVerifiedUser(client);
  if (!user) return { authenticated: false };
  const request = isLiked
    ? client.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    : client.from('post_likes').insert({ post_id: postId, user_id: user.id });
  const { error } = await request;
  if (error) throw error;
  return { authenticated: true, user };
}
