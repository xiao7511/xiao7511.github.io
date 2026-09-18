export async function getVerifiedUser(client) {
  const {
    data: { user },
    error
  } = await client.auth.getUser();
  if (error) throw error;
  return user;
}

export function observeSession(client, listener) {
  return client.auth.onAuthStateChange((_event, session) => listener(session));
}
