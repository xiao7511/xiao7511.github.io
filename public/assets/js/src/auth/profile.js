export async function fetchProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('id,nickname,avatar_url,created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function waitForProvisionedProfile(
  client,
  userId,
  {
    attempts = 4,
    delayMs = 150,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  } = {}
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const profile = await fetchProfile(client, userId);
    if (profile) return profile;
    if (attempt + 1 < attempts) await sleep(delayMs);
  }
  throw new Error('PROFILE_NOT_PROVISIONED');
}

export async function updateProvisionedNickname(client, userId, nickname) {
  const result = await client.from('profiles').update({ nickname }).eq('id', userId).select('id').maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('PROFILE_NOT_PROVISIONED');
}
