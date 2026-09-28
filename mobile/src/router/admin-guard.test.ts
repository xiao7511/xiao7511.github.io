import type { RouteLocationNormalized } from 'vue-router';
import { describe, expect, test } from 'vitest';
import { adminRedirect } from './admin-guard';

const adminRoute = { meta: { requiresAdmin: true }, fullPath: '/admin' } as RouteLocationNormalized;

describe('admin route guard', () => {
  test('redirects guests to login and preserves the route', () => {
    expect(adminRedirect(adminRoute, false, false)).toEqual({ name: 'login', query: { redirect: '/admin' } });
  });

  test('blocks authenticated non-admin users', () => {
    expect(adminRedirect(adminRoute, true, false)).toEqual({ name: 'profile', query: { forbidden: 'admin' } });
  });

  test('allows administrators and ignores public routes', () => {
    expect(adminRedirect(adminRoute, true, true)).toBe(true);
    expect(adminRedirect({ meta: {}, fullPath: '/' } as RouteLocationNormalized, false, false)).toBe(true);
  });
});
