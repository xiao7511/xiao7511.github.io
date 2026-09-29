import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchRuntimeConfig } from '../public/assets/js/src/api/config.js';
import {
  ModerationAccessError,
  initializeModeration,
  loadAuthorizedReports,
  reviewModerationReport
} from '../public/assets/js/src/moderation/service.js';

function reportQuery(result) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(result)
  };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function clientWith({ user = { id: 'admin-id' }, admin = true, adminError = null, reports = [] } = {}) {
  const query = reportQuery({ data: reports, error: null });
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: user ? { user } : null }, error: null })
    },
    rpc: vi.fn(async (name) =>
      name === 'is_admin' ? { data: admin, error: adminError } : { data: null, error: null }
    ),
    from: vi.fn(() => query)
  };
  return { client, query };
}

afterEach(() => vi.unstubAllGlobals());

describe('Web moderation runtime and authorization', () => {
  test('loads Supabase URL and browser key through the canonical runtime endpoint', async () => {
    vi.stubGlobal('window', { SiteConfig: { siteOrigin: 'https://site.test', apiOrigin: 'https://api.test' } });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ SUPABASE_URL: 'https://db.test', ANON_KEY: 'browser-key' })
    });
    vi.stubGlobal('fetch', fetch);
    await expect(fetchRuntimeConfig()).resolves.toEqual({ SUPABASE_URL: 'https://db.test', ANON_KEY: 'browser-key' });
    expect(fetch).toHaveBeenCalledWith('https://api.test/', { headers: { Accept: 'application/json' } });
  });

  test('fails safely when the required runtime configuration is unavailable', async () => {
    vi.stubGlobal('window', {});
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(fetchRuntimeConfig()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not load moderation data for an anonymous user', async () => {
    const { client } = clientWith({ user: null });
    await expect(initializeModeration(async () => client)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  test('does not load moderation data for an authenticated non-admin', async () => {
    const { client } = clientWith({ admin: false });
    await expect(initializeModeration(async () => client)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(client.rpc).toHaveBeenCalledWith('is_admin');
    expect(client.from).not.toHaveBeenCalled();
  });

  test('allows an authenticated administrator through the is_admin RPC', async () => {
    const reports = [{ id: 7, reason: 'spam' }];
    const { client } = clientWith({ reports });
    await expect(initializeModeration(async () => client)).resolves.toEqual({ client, reports });
    expect(client.rpc).toHaveBeenCalledWith('is_admin');
    expect(client.from).toHaveBeenCalledWith('post_reports');
  });

  test('fails closed when the is_admin RPC fails', async () => {
    const { client } = clientWith({ adminError: new Error('network') });
    await expect(initializeModeration(async () => client)).rejects.toEqual(
      new ModerationAccessError('AUTHORIZATION_FAILURE')
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  test('never queries profiles.is_admin in the active moderation data flow', async () => {
    const { client } = clientWith();
    await loadAuthorizedReports(client);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('post_reports');
  });

  test('uses the canonical report-review RPC for authorized moderation actions', async () => {
    const { client } = clientWith();
    await reviewModerationReport(client, 9, 'hide', '  policy violation  ');
    expect(client.rpc).toHaveBeenCalledWith('review_post_report', {
      p_report_id: 9,
      p_action: 'hide',
      p_note: 'policy violation'
    });
  });

  test('returns an empty report list safely', async () => {
    const { client } = clientWith({ reports: [] });
    await expect(loadAuthorizedReports(client)).resolves.toEqual([]);
  });

  test('does not return privileged content when the moderation API fails', async () => {
    const { client, query } = clientWith({ reports: [{ id: 99, post: { content: 'private' } }] });
    query.limit.mockResolvedValue({ data: [{ id: 99, post: { content: 'private' } }], error: new Error('denied') });
    await expect(loadAuthorizedReports(client)).rejects.toThrow('denied');
  });
});
