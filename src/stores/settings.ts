import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type { IngestRun, SourceHealth } from '@/types/jobs';

export type AppSettings = {
  id: 1;
  notify_enabled: boolean;
  min_score_notify: number;
  updated_at: string;
};

export type NotificationStatus = {
  tracked: number;
  pending: number;
  lastNotifiedAt: string | null;
  migrationRequired: boolean;
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: {
      id: 1,
      notify_enabled: false,
      min_score_notify: 3,
      updated_at: new Date().toISOString(),
    } as AppSettings,
    runs: [] as IngestRun[],
    sourceHealth: [] as SourceHealth[],
    telegramConfigured: false,
    notificationStatus: {
      tracked: 0,
      pending: 0,
      lastNotifiedAt: null,
      migrationRequired: false,
    } as NotificationStatus,
    loading: false,
    saving: false,
    error: null as string | null,
  }),
  actions: {
    async fetchSettings() {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiFetch<{
          settings: AppSettings;
          runs: IngestRun[];
          sourceHealth: SourceHealth[];
          notificationStatus: NotificationStatus;
          telegramConfigured: boolean;
        }>('/settings');
        this.settings = response.settings;
        this.runs = response.runs;
        this.sourceHealth = response.sourceHealth;
        this.notificationStatus = response.notificationStatus;
        this.telegramConfigured = response.telegramConfigured;
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
    async rerunSource(source: string) {
      this.saving = true;
      this.error = null;
      try {
        await apiFetch(`/ingest?source=${encodeURIComponent(source)}`, { method: 'POST' });
        await this.fetchSettings();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to rerun source';
      } finally {
        this.saving = false;
      }
    },
  },
});
