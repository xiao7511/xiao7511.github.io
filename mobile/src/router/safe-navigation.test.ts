import { describe, expect, test } from 'vitest';
import { parseRouteInteger, safeInternalPath } from './safe-navigation';

describe('safe internal navigation', () => {
  test('keeps valid app routes and query parameters', () => {
    expect(safeInternalPath('/community/new?draft=1')).toBe('/community/new?draft=1');
  });

  test('rejects external, protocol-relative and backslash targets', () => {
    expect(safeInternalPath('https://evil.example', '/profile')).toBe('/profile');
    expect(safeInternalPath('//evil.example', '/profile')).toBe('/profile');
    expect(safeInternalPath('/\\evil.example', '/profile')).toBe('/profile');
  });

  test('accepts only canonical safe integer route parameters', () => {
    expect(parseRouteInteger('0')).toBe(0);
    expect(parseRouteInteger('12', 1)).toBe(12);
    for (const value of ['', ' 1', '01', '+1', '1.0', '1e2', '-1', '9007199254740992', ['1'], null]) {
      expect(parseRouteInteger(value, 1)).toBeNull();
    }
    expect(parseRouteInteger('0', 1)).toBeNull();
  });
});
