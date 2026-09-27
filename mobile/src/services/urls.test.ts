import { describe, expect, test } from 'vitest';
import { safeExternalUrl } from './urls';

describe('unsafe URL rejection', () => {
  test('allows HTTP(S) and rejects executable or embedded schemes', () => {
    expect(safeExternalUrl('https://www.nobistudio.com/path')).toBe('https://www.nobistudio.com/path');
    expect(safeExternalUrl('http://localhost:5173/path')).toBe('http://localhost:5173/path');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('data:text/html,unsafe')).toBeUndefined();
  });
});
