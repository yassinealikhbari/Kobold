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
      <RouterLink class="brand" to="/">
        <span class="brand-kicker">KOBOLD / 2026</span>
        <span class="brand-wordmark">KOBOLD</span>
      </RouterLink>
      <nav class="nav-list" aria-label="Main navigation">
        <RouterLink v-for="(item, index) in navItems" :key="item.to" :to="item.to">
          <span class="nav-index">0{{ index + 1 }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
