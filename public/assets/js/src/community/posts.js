export function groupLikesByPostId(rows = []) {
  const groups = new Map();
  for (const { post_id: postId, user_id: userId } of rows) {
    if (!groups.has(postId)) groups.set(postId, []);
    groups.get(postId).push(userId);
  }
  return groups;
}
