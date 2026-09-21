function decodeJwtPayload(accessToken) {
  try {
    const payloadPart = String(accessToken || '').split('.')[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

export function summarizeAccessToken(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  return {
    hasSub: Boolean(payload?.sub),
    role: payload?.role,
    exp: payload?.exp
  };
}

function hasUsableSession(session) {
  if (!session?.user?.id || !session.access_token) return false;
  const payload = decodeJwtPayload(session.access_token);
  const expiresAt = Number(payload?.exp);
  return Boolean(payload?.sub === session.user.id && Number.isFinite(expiresAt) && expiresAt * 1000 > Date.now());
}

function isMissingSessionError(error) {
  return Boolean(
    error?.name === 'AuthSessionMissingError' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('auth session missing')
  );
}

export function isAuthJwtError(error) {
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const message = String(error?.message || error?.msg || '').toLowerCase();
  return (
    code === 'bad_jwt' ||
    message.includes('missing sub claim') ||
    message.includes('jwt expired') ||
    message.includes('expired jwt') ||
    message.includes('invalid claim')
  );
}

export async function refreshAuthenticatedSession(client) {
  try {
    const { data, error } = await client.auth.refreshSession();
    const session = data?.session || null;
    return {
      session: !error && hasUsableSession(session) ? session : null,
      refreshed: true,
      error: error || null
    };
  } catch (error) {
    return { session: null, refreshed: true, error };
  }
}

export async function getAuthenticatedSession(client) {
  const { data, error } = await client.auth.getSession();
  if (error) {
    if (isMissingSessionError(error)) return { session: null, refreshed: false, error: null };
    if (isAuthJwtError(error)) return refreshAuthenticatedSession(client);
    throw error;
  }

  const session = data?.session || null;
  if (!session) return { session: null, refreshed: false, error: null };
  if (hasUsableSession(session)) return { session, refreshed: false, error: null };
  return refreshAuthenticatedSession(client);
}

export function observeSession(client, listener) {
  return client.auth.onAuthStateChange((_event, session) => listener(session));
}
