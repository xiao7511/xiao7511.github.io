import type { RouteLocationNormalized } from 'vue-router';

export function adminRedirect(
  to: RouteLocationNormalized,
  authenticated: boolean,
  administrator: boolean
): true | { name: string; query?: Record<string, string> } {
  if (!to.meta.requiresAdmin) return true;
  if (!authenticated) return { name: 'login', query: { redirect: to.fullPath } };
  if (!administrator) return { name: 'profile', query: { forbidden: 'admin' } };
  return true;
}
