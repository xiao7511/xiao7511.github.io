import type { RouteLocationNormalized } from 'vue-router';

export function authRedirect(
  to: RouteLocationNormalized,
  authenticated: boolean
): true | { name: string; query: { redirect: string } } {
  if (!to.meta.requiresAuth || authenticated) return true;
  return { name: 'login', query: { redirect: to.fullPath } };
}
