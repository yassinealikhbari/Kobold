<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import {
  isWorkspaceMode,
  resolveWorkspaceMode,
  WORKSPACE_MODE_STORAGE_KEY,
  workspaceLandingPath,
  workspaceModeForPath,
  type WorkspaceMode,
} from '@/lib/workspace-mode';

const route = useRoute();

const jobNavItems = [
  { to: '/', label: 'Board' },
  { to: '/tracker', label: 'Tracker' },
];

const freelanceNavItems = [
  { to: '/freelance', label: 'Pipeline' },
  { to: '/freelance/organizations', label: 'Organizations' },
  { to: '/freelance/contacts', label: 'Contacts' },
  { to: '/freelance/templates', label: 'Templates' },
];

const sharedNavItems = [
  { to: '/today', label: 'Today' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

function readRememberedMode(): WorkspaceMode | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
  return isWorkspaceMode(value) ? value : null;
}

const rememberedMode = ref<WorkspaceMode | null>(readRememberedMode());
const activeMode = computed(() => resolveWorkspaceMode(route.path, rememberedMode.value));
const modeNavItems = computed(() =>
  activeMode.value === 'freelance' ? freelanceNavItems : jobNavItems,
);
const brandTarget = computed(() => workspaceLandingPath(activeMode.value));

function rememberMode(mode: WorkspaceMode) {
  rememberedMode.value = mode;
  window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, mode);
}

function isActivePath(path: string): boolean {
  if (path === '/') return route.path === '/';
  if (path === '/freelance') return route.path === '/freelance';
  return route.path === path || route.path.startsWith(`${path}/`);
}

watch(
  () => route.path,
  (path) => {
    const routeMode = workspaceModeForPath(path);
    if (routeMode) rememberMode(routeMode);
  },
  { immediate: true },
);
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" :to="brandTarget">
        <span class="brand-kicker">KOBOLD / 2026</span>
        <span class="brand-wordmark">KOBOLD</span>
      </RouterLink>

      <nav class="mode-switch" aria-label="Workspace mode">
        <RouterLink
          to="/freelance"
          :class="{ 'is-active': activeMode === 'freelance' }"
          :aria-current="activeMode === 'freelance' ? 'page' : undefined"
          @click="rememberMode('freelance')"
        >
          Freelance
        </RouterLink>
        <RouterLink
          to="/"
          :class="{ 'is-active': activeMode === 'jobs' }"
          :aria-current="activeMode === 'jobs' ? 'page' : undefined"
          @click="rememberMode('jobs')"
        >
          Job Hunt
        </RouterLink>
      </nav>

      <div class="workspace-navigation">
        <nav class="nav-list" :aria-label="`${activeMode === 'freelance' ? 'Freelance' : 'Job hunt'} navigation`">
          <RouterLink
            v-for="(item, index) in modeNavItems"
            :key="item.to"
            :to="item.to"
            :class="{ 'is-active': isActivePath(item.to) }"
            :aria-current="isActivePath(item.to) ? 'page' : undefined"
          >
            <span class="nav-index">0{{ index + 1 }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>

        <nav class="nav-list shared-nav" aria-label="Shared navigation">
          <RouterLink
            v-for="(item, index) in sharedNavItems"
            :key="item.to"
            :to="item.to"
            :class="{ 'is-active': isActivePath(item.to) }"
            :aria-current="isActivePath(item.to) ? 'page' : undefined"
          >
            <span class="nav-index">S{{ index + 1 }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
