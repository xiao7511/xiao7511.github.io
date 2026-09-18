export async function createReply(client, reply) {
  const { error } = await client.from('posts').insert([reply]);
  if (error) throw error;
}
