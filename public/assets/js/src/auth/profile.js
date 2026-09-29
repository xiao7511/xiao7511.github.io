export async function fetchProfile(client, userId) {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProvisionedProfile(client, userId, { nickname, avatarUrl }) {
  const result = await client
    .from('profiles')
    .update({ nickname: nickname || null, avatar_url: avatarUrl || null })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('PROFILE_NOT_PROVISIONED');
}
