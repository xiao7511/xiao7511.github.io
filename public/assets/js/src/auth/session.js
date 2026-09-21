export async function getVerifiedUser(client) {
  const {
    data: { user },
    error
  } = await client.auth.getUser();
  if (error) {
    const missingSession =
      error.name === 'AuthSessionMissingError' ||
      String(error.message || '')
        .toLowerCase()
        .includes('auth session missing');
    if (missingSession) return null;
    throw error;
  }
  return user;
}

export function observeSession(client, listener) {
  return client.auth.onAuthStateChange((_event, session) => listener(session));
}
