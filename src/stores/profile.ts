import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type { CandidateProfile } from '@/types/profile';

function emptyProfile(): CandidateProfile {
  return {
    id: 1,
    full_name: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    portfolio: null,
    summary: null,
    skills: [],
    languages: [],
    work_history: [],
    experience_years: 5.5,
    cv_path: null,
    updated_at: new Date().toISOString(),
  };
}

export const useProfileStore = defineStore('profile', {
  state: () => ({
    profile: emptyProfile(),
    loading: false,
    saving: false,
    uploading: false,
    error: null as string | null,
    cvUrl: '',
  }),
  getters: {
    complete(state) {
      return Boolean(state.profile.summary && state.profile.cv_path);
    },
  },
  actions: {
    async fetchProfile() {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiFetch<{ profile: CandidateProfile }>('/profile');
        this.profile = response.profile;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load profile';
      } finally {
        this.loading = false;
      }
    },
    async saveProfile() {
      this.saving = true;
      this.error = null;

      try {
        const response = await apiFetch<{ profile: CandidateProfile }>('/profile', {
          method: 'PUT',
          body: this.profile,
        });
        this.profile = response.profile;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to save profile';
      } finally {
        this.saving = false;
      }
    },
    async uploadCv(file: File) {
      this.uploading = true;
      this.error = null;

      try {
        const body = new FormData();
        body.set('cv', file);
        const response = await apiFetch<{ profile: CandidateProfile }>('/profile/cv', {
          method: 'POST',
          body,
        });
        this.profile = response.profile;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to upload CV';
      } finally {
        this.uploading = false;
      }
    },
    async fetchCvUrl() {
      const response = await apiFetch<{ url: string }>('/profile/cv');
      this.cvUrl = response.url;
      return response.url;
    },
  },
});
