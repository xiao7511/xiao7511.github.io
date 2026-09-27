import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/anime', name: 'anime', component: () => import('../views/AnimeView.vue') },
    { path: '/manga', name: 'manga', component: () => import('../views/MangaView.vue') },
    { path: '/community', name: 'community', component: () => import('../views/CommunityView.vue') },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
});
