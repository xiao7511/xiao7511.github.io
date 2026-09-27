import { describe, expect, test } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { authRedirect } from './auth-guard';

describe('route auth guard', () => {
  test('redirects a protected route and preserves its target', () => {
    const route = { meta: { requiresAuth: true }, fullPath: '/community/new' } as RouteLocationNormalized;
    expect(authRedirect(route, false)).toEqual({ name: 'login', query: { redirect: '/community/new' } });
  });

  test('allows public routes and authenticated users', () => {
    expect(authRedirect({ meta: {}, fullPath: '/community' } as RouteLocationNormalized, false)).toBe(true);
    expect(
      authRedirect({ meta: { requiresAuth: true }, fullPath: '/community/new' } as RouteLocationNormalized, true)
    ).toBe(true);
  });
});
