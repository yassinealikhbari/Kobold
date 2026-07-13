<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';

const navItems = [
  { to: '/', label: 'Board' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">Vue Job Hunter</RouterLink>
      <nav class="nav-list" aria-label="Main navigation">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
