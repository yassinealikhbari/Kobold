import { createRouter, createWebHistory } from 'vue-router';

import Board from './pages/Board.vue';
import FreelanceArchive from './pages/FreelanceArchive.vue';
import FreelanceContacts from './pages/FreelanceContacts.vue';
import FreelanceContactDetail from './pages/FreelanceContactDetail.vue';
import FreelanceImport from './pages/FreelanceImport.vue';
import FreelanceOpportunityContact from './pages/FreelanceOpportunityContact.vue';
import FreelanceOpportunityDetail from './pages/FreelanceOpportunityDetail.vue';
import FreelanceOrganizationDetail from './pages/FreelanceOrganizationDetail.vue';
import FreelanceOrganizations from './pages/FreelanceOrganizations.vue';
import FreelancePipeline from './pages/FreelancePipeline.vue';
import FreelanceTemplates from './pages/FreelanceTemplates.vue';
import FreelanceMetrics from './pages/FreelanceMetrics.vue';
import JobDetail from './pages/JobDetail.vue';
import Login from './pages/Login.vue';
import Profile from './pages/Profile.vue';
import Settings from './pages/Settings.vue';
import Today from './pages/Today.vue';
import Tracker from './pages/Tracker.vue';
import {
  isWorkspaceMode,
  WORKSPACE_MODE_STORAGE_KEY,
  workspaceLandingPath,
} from './lib/workspace-mode';
import { useAuthStore } from './stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', name: 'board', component: Board, meta: { requiresAuth: true } },
    { path: '/jobs/:id', name: 'job-detail', component: JobDetail, meta: { requiresAuth: true } },
    { path: '/tracker', name: 'tracker', component: Tracker, meta: { requiresAuth: true } },
    {
      path: '/freelance',
      name: 'freelance-pipeline',
      component: FreelancePipeline,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/organizations',
      name: 'freelance-organizations',
      component: FreelanceOrganizations,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/organizations/:id',
      name: 'freelance-organization-detail',
      component: FreelanceOrganizationDetail,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/contacts',
      name: 'freelance-contacts',
      component: FreelanceContacts,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/contacts/:id',
      name: 'freelance-contact-detail',
      component: FreelanceContactDetail,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/opportunities/:id',
      name: 'freelance-opportunity-detail',
      component: FreelanceOpportunityDetail,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/opportunities/:id/contact',
      name: 'freelance-opportunity-contact',
      component: FreelanceOpportunityContact,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/templates',
      name: 'freelance-templates',
      component: FreelanceTemplates,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/import',
      name: 'freelance-import',
      component: FreelanceImport,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/metrics',
      name: 'freelance-metrics',
      component: FreelanceMetrics,
      meta: { requiresAuth: true },
    },
    {
      path: '/freelance/archive',
      name: 'freelance-archive',
      component: FreelanceArchive,
      meta: { requiresAuth: true },
    },
    { path: '/today', name: 'today', component: Today, meta: { requiresAuth: true } },
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
    const storedMode = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    const fallback = workspaceLandingPath(isWorkspaceMode(storedMode) ? storedMode : 'jobs');
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : fallback;
    return redirect;
  }

  return true;
});

export default router;
