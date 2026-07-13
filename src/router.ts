import { createRouter, createWebHistory } from 'vue-router';

import Board from './pages/Board.vue';
import JobDetail from './pages/JobDetail.vue';
import Login from './pages/Login.vue';
import Profile from './pages/Profile.vue';
import Settings from './pages/Settings.vue';
import Tracker from './pages/Tracker.vue';
import { useAuthStore } from './stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', name: 'board', component: Board, meta: { requiresAuth: true } },
    { path: '/jobs/:id', name: 'job-detail', component: JobDetail, meta: { requiresAuth: true } },
    { path: '/tracker', name: 'tracker', component: Tracker, meta: { requiresAuth: true } },
    { path: '/profile', name: 'profile', component: Profile, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: Settings, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const authenticated = await auth.checkSession();

  if (to.meta.requiresAuth && !authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.name === 'login' && authenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/';
    return redirect;
  }

  return true;
});

export default router;
