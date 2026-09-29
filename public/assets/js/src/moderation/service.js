const MODERATION_ACTIONS = new Set(['dismiss', 'hide', 'remove', 'restore']);

export class ModerationAccessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ModerationAccessError';
    this.code = code;
  }
}

export async function requireModerationAdmin(client) {
  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw new ModerationAccessError('AUTH_FAILURE');
  const user = sessionResult.data?.session?.user;
  if (!user) throw new ModerationAccessError('UNAUTHENTICATED');

  const adminResult = await client.rpc('is_admin');
  if (adminResult.error) throw new ModerationAccessError('AUTHORIZATION_FAILURE');
  if (adminResult.data !== true) throw new ModerationAccessError('UNAUTHORIZED');
  return user;
}

export async function fetchPendingReports(client) {
  const result = await client
    .from('post_reports')
    .select('id,post_id,reason,details,status,created_at,post:posts(content,nickname,user_id,moderation_status)')
    .in('status', ['pending', 'reviewing'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : [];
}

export async function loadAuthorizedReports(client) {
  await requireModerationAdmin(client);
  return fetchPendingReports(client);
}

export async function initializeModeration(createClient) {
  const client = await createClient();
  const reports = await loadAuthorizedReports(client);
  return { client, reports };
}

export async function reviewModerationReport(client, reportId, action, note = '') {
  if (!Number.isInteger(reportId) || reportId <= 0 || !MODERATION_ACTIONS.has(action)) {
    throw new TypeError('INVALID_MODERATION_REQUEST');
  }
  const result = await client.rpc('review_post_report', {
    p_report_id: reportId,
    p_action: action,
    p_note: note.trim() || null
  });
  if (result.error) throw result.error;
}
