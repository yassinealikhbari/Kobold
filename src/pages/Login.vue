<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import PageHeader from '@/components/PageHeader.vue';
import { ApiError } from '@/lib/api';
import {
  isWorkspaceMode,
  WORKSPACE_MODE_STORAGE_KEY,
  workspaceLandingPath,
} from '@/lib/workspace-mode';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const password = ref('');
const errorMessage = ref('');

function preferredLandingPath(): string {
  const storedMode = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
  return workspaceLandingPath(isWorkspaceMode(storedMode) ? storedMode : 'jobs');
}

async function submit() {
  errorMessage.value = '';

  try {
    await auth.login(password.value);
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : preferredLandingPath();
    await router.replace(redirect);
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      errorMessage.value = 'Too many attempts. Try again later.';
      return;
    }

    errorMessage.value = 'Invalid password.';
  }
}
</script>

<template>
  <section class="page">
    <PageHeader eyebrow="Access" title="Login" />
    <form class="panel" @submit.prevent="submit">
      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        autofocus
      />
      <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      <button type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  </section>
</template>
