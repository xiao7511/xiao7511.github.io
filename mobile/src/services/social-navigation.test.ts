import { afterEach, describe, expect, test, vi } from 'vitest';
import { openSocialLink } from './social-navigation';

describe('safe social external navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('opens only a configured URL for its canonical platform', () => {
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', open);
    expect(openSocialLink(' https://x.com/nobi ', 'x')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://x.com/nobi', '_blank', 'noopener,noreferrer');
  });

  test('does not pass an invalid or empty URL to the external opener', () => {
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', open);
    expect(openSocialLink('javascript:alert(1)', 'x')).toBe(false);
    expect(openSocialLink('', 'weibo')).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  test('reports a blocked or failed external open without throwing', () => {
    const open = vi.fn().mockReturnValue(null);
    vi.stubGlobal('open', open);
    expect(openSocialLink('https://weibo.com/nobi', 'weibo')).toBe(false);
    open.mockImplementationOnce(() => {
      throw new Error('runtime details are private');
    });
    expect(openSocialLink('https://weibo.com/nobi', 'weibo')).toBe(false);
  });
});
