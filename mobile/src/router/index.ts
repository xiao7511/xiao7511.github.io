import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { authRedirect } from './auth-guard';
import { adminRedirect } from './admin-guard';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
  }
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/search', name: 'search', component: () => import('../views/SearchView.vue') },
    { path: '/anime', name: 'anime', component: () => import('../views/AnimeView.vue') },
    { path: '/anime/:id', name: 'anime-detail', component: () => import('../views/ContentDetailView.vue') },
    { path: '/manga', name: 'manga', component: () => import('../views/MangaView.vue') },
    { path: '/manga/:id', name: 'manga-detail', component: () => import('../views/ContentDetailView.vue') },
    { path: '/banner/:slot/:id', name: 'banner-detail', component: () => import('../views/ContentDetailView.vue') },
    { path: '/community', name: 'community', component: () => import('../views/CommunityView.vue') },
    {
      path: '/community/new',
      name: 'community-new',
      component: () => import('../views/ComposePostView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/community/:id/report',
      name: 'community-report',
      component: () => import('../views/ReportPostView.vue'),
      meta: { requiresAuth: true }
    },
    { path: '/community/:id', name: 'community-detail', component: () => import('../views/PostDetailView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminDashboardView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/AdminUsersView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/reports',
      name: 'admin-reports',
      component: () => import('../views/AdminReportsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/banners',
      name: 'admin-banners',
      component: () => import('../views/AdminBannersView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/content/:category(anime|manga)',
      name: 'admin-content',
      component: () => import('../views/AdminContentView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/social',
      name: 'admin-social',
      component: () => import('../views/AdminSocialView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/account/delete',
      name: 'account-delete',
      component: () => import('../views/AccountDeleteView.vue'),
      meta: { requiresAuth: true }
    },
    { path: '/privacy', name: 'privacy', component: () => import('../views/PrivacyView.vue') },
    { path: '/support', name: 'support', component: () => import('../views/SupportView.vue') },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!to.meta.requiresAuth && !to.meta.requiresAdmin) {
    void auth.initialize().catch(() => undefined);
    return true;
  }
  await auth.initialize();
  const authResult = authRedirect(to, Boolean(auth.session));
  if (authResult !== true) return authResult;
  return adminRedirect(to, Boolean(auth.session), auth.isAdmin);
});
