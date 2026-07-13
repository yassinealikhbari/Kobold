<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const password = ref('');
const errorMessage = ref('');

async function submit() {
  errorMessage.value = '';

  try {
    await auth.login(password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
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
    <header class="page-header">
      <p class="eyebrow">Access</p>
      <h1>Login</h1>
    </header>
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
