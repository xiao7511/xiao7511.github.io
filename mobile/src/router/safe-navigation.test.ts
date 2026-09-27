import { describe, expect, test } from 'vitest';
import { safeInternalPath } from './safe-navigation';

describe('safe internal navigation', () => {
  test('keeps valid app routes and query parameters', () => {
    expect(safeInternalPath('/community/new?draft=1')).toBe('/community/new?draft=1');
  });

  test('rejects external, protocol-relative and backslash targets', () => {
    expect(safeInternalPath('https://evil.example', '/profile')).toBe('/profile');
    expect(safeInternalPath('//evil.example', '/profile')).toBe('/profile');
    expect(safeInternalPath('/\\evil.example', '/profile')).toBe('/profile');
  });
});
