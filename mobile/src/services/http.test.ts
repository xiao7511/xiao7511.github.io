import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchJson } from './http';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('API error normalization', () => {
  test.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [503, 'SERVER_ERROR']
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(fetchJson('https://example.test')).rejects.toMatchObject({ code, status });
  });

  test('maps fetch failures and invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(fetchJson('https://example.test')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));
    await expect(fetchJson('https://example.test')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  test('maps its own deadline to TIMEOUT', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          })
      )
    );
    const request = fetchJson('https://example.test', { timeoutMs: 20 });
    const assertion = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(21);
    await assertion;
  });
});
