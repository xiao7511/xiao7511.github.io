import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { authRedirect } from './auth-guard';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/anime', name: 'anime', component: () => import('../views/AnimeView.vue') },
    { path: '/anime/:id', name: 'anime-detail', component: () => import('../views/ContentDetailView.vue') },
    { path: '/manga', name: 'manga', component: () => import('../views/MangaView.vue') },
    { path: '/manga/:id', name: 'manga-detail', component: () => import('../views/ContentDetailView.vue') },
    { path: '/community', name: 'community', component: () => import('../views/CommunityView.vue') },
    {
      path: '/community/new',
      name: 'community-new',
      component: () => import('../views/ComposePostView.vue'),
      meta: { requiresAuth: true }
    },
    { path: '/community/:id', name: 'community-detail', component: () => import('../views/PostDetailView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  return authRedirect(to, Boolean(auth.session));
});
