import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';

type SessionResponse = {
  authenticated: boolean;
};

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authenticated: false,
    checked: false,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async checkSession() {
      if (this.checked) return this.authenticated;

      try {
        const session = await apiFetch<SessionResponse>('/auth/session');
        this.authenticated = session.authenticated;
      } catch {
        this.authenticated = false;
      } finally {
        this.checked = true;
      }

      return this.authenticated;
    },
    async login(password: string) {
      this.loading = true;
      this.error = null;

      try {
        const session = await apiFetch<SessionResponse>('/auth/login', {
          method: 'POST',
          body: { password },
        });

        this.authenticated = session.authenticated;
        this.checked = true;
      } catch (error) {
        this.authenticated = false;
        this.error = error instanceof Error ? error.message : 'Login failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      await apiFetch<SessionResponse>('/auth/logout', { method: 'POST' });
      this.authenticated = false;
      this.checked = true;
    },
  },
});
