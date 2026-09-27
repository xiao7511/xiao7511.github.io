import { describe, expect, test } from 'vitest';
import { contentWebUrl, safeExternalUrl, safeShareUrl } from './urls';

describe('unsafe URL rejection', () => {
  test('allows HTTP(S) and rejects executable or embedded schemes', () => {
    expect(safeExternalUrl('https://www.nobistudio.com/path')).toBe('https://www.nobistudio.com/path');
    expect(safeExternalUrl('http://localhost:5173/path')).toBe('http://localhost:5173/path');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('data:text/html,unsafe')).toBeUndefined();
  });

  test('only shares public HTTPS URLs and never localhost', () => {
    expect(safeShareUrl('https://www.nobistudio.com/anime/1')).toBe('https://www.nobistudio.com/anime/1');
    expect(safeShareUrl('http://www.nobistudio.com/anime/1')).toBeUndefined();
    expect(safeShareUrl('https://localhost/anime/1')).toBeUndefined();
    expect(contentWebUrl('anime', 2)).toBe('https://www.nobistudio.com/detail.html?category=anime&slot=2');
  });
});
