import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type { Application, ApplicationStatus } from '@/types/applications';

export type TrackedApplication = Application & {
  jobs: {
    id: string;
    title: string;
    company: string;
    url: string;
    status: string;
  };
};

export const APPLICATION_STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];

export const useApplicationsStore = defineStore('applications', {
  state: () => ({
    applications: [] as TrackedApplication[],
    selected: null as TrackedApplication | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchApplications() {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiFetch<{ applications: TrackedApplication[] }>('/applications');
        this.applications = response.applications;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load applications';
      } finally {
        this.loading = false;
      }
    },
    async updateApplication(id: string, patch: Partial<Application>) {
      const previous = this.applications.map((application) => ({ ...application }));
      this.applications = this.applications.map((application) =>
        application.id === id ? { ...application, ...patch, updated_at: new Date().toISOString() } : application,
      );

      try {
        const response = await apiFetch<{ application: Application }>(`/applications/${id}`, {
          method: 'PATCH',
          body: patch,
        });
        this.applications = this.applications.map((application) =>
          application.id === id ? { ...application, ...response.application } : application,
        );
        if (this.selected?.id === id) {
          this.selected = this.applications.find((application) => application.id === id) ?? null;
        }
      } catch (error) {
        this.applications = previous;
        this.error = error instanceof Error ? error.message : 'Failed to update application';
      }
    },
    async deleteApplication(id: string) {
      await apiFetch(`/applications/${id}`, { method: 'DELETE' });
      this.applications = this.applications.filter((application) => application.id !== id);
      if (this.selected?.id === id) this.selected = null;
    },
    select(application: TrackedApplication | null) {
      this.selected = application;
    },
  },
});
