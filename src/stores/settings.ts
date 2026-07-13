import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type { IngestRun, Job } from '@/types/jobs';

export type AppSettings = {
  id: 1;
  notify_enabled: boolean;
  min_score_notify: number;
  updated_at: string;
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: {
      id: 1,
      notify_enabled: true,
      min_score_notify: 3,
      updated_at: new Date().toISOString(),
    } as AppSettings,
    hiddenJobs: [] as Job[],
    runs: [] as IngestRun[],
    loading: false,
    saving: false,
    error: null as string | null,
  }),
  actions: {
    async fetchSettings() {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiFetch<{ settings: AppSettings; hiddenJobs: Job[]; runs: IngestRun[] }>('/settings');
        this.settings = response.settings;
        this.hiddenJobs = response.hiddenJobs;
        this.runs = response.runs;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load settings';
      } finally {
        this.loading = false;
      }
    },
    async saveSettings() {
      this.saving = true;
      this.error = null;

      try {
        const response = await apiFetch<{ settings: AppSettings }>('/settings', {
          method: 'PUT',
          body: this.settings,
        });
        this.settings = response.settings;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to save settings';
      } finally {
        this.saving = false;
      }
    },
    async restoreJob(id: string) {
      await apiFetch(`/jobs/${id}`, {
        method: 'PATCH',
        body: { status: 'active' },
      });
      this.hiddenJobs = this.hiddenJobs.filter((job) => job.id !== id);
    },
  },
});
