import { describe, expect, test, vi } from 'vitest';
import { shareWithFallback } from './share';

const payload = { title: 'NOBI', url: 'https://www.nobistudio.com/anime/example' };

describe('native share fallback', () => {
  test('uses the native share sheet when available', async () => {
    const nativeShare = vi.fn(async () => undefined);
    expect(await shareWithFallback(payload, { native: true, nativeShare })).toBe('native');
    expect(nativeShare).toHaveBeenCalledWith(payload);
  });

  test('falls back to Web Share when the native adapter is unavailable', async () => {
    const webShare = vi.fn(async () => undefined);
    expect(
      await shareWithFallback(payload, {
        native: true,
        webShare
      })
    ).toBe('web');
    expect(webShare).toHaveBeenCalledWith(payload);
  });

  test('propagates native share errors for the page Toast', async () => {
    await expect(
      shareWithFallback(payload, {
        native: true,
        nativeShare: async () => Promise.reject(new Error('share failed')),
        copy: async () => undefined
      })
    ).rejects.toThrow('share failed');
  });

  test('copies the HTTPS URL when share APIs are unavailable', async () => {
    const copy = vi.fn(async () => undefined);
    expect(await shareWithFallback(payload, { native: false, copy })).toBe('clipboard');
    expect(copy).toHaveBeenCalledWith(payload.url);
  });
});
