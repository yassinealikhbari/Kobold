import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type { IngestRun, Job, JobStatus } from '@/types/jobs';

export type JobFilters = {
  q: string;
  workplace: string;
  source: string;
  minScore: number;
  showStale: boolean;
  sort: 'score' | 'posted';
};

type JobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  hasMore: boolean;
};

let activeJobsRequest: AbortController | null = null;
let jobsRequestSequence = 0;

export const SOURCES = [
  'arbeitnow',
  'vuejobs',
  'workingnomads',
  'remoteok',
  'berlinstartupjobs',
  'germantechjobs',
];

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    jobs: [] as Job[],
    selectedJob: null as Job | null,
    syncRuns: [] as IngestRun[],
    total: 0,
    page: 0,
    hasMore: false,
    loading: false,
    refreshing: false,
    error: null as string | null,
    refreshProgress: '',
    filters: {
      q: '',
      workplace: '',
      source: '',
      minScore: 3,
      showStale: false,
      sort: 'score',
    } as JobFilters,
  }),
  actions: {
    async fetchJobs(options: { append?: boolean } = {}) {
      const append = options.append ?? false;
      const nextPage = append ? this.page + 1 : 1;
      activeJobsRequest?.abort();
      const controller = new AbortController();
      activeJobsRequest = controller;
      const requestSequence = ++jobsRequestSequence;
      this.loading = true;
      this.error = null;

      try {
        const params = new URLSearchParams({
          status: this.filters.showStale ? 'active,stale' : 'active',
          sort: this.filters.sort,
          minScore: String(this.filters.minScore),
          page: String(nextPage),
        });

        if (this.filters.q) params.set('q', this.filters.q);
        if (this.filters.workplace) params.set('workplace', this.filters.workplace);
        if (this.filters.source) params.set('source', this.filters.source);

        const response = await apiFetch<JobsResponse>(`/jobs?${params.toString()}`, { signal: controller.signal });
        if (requestSequence !== jobsRequestSequence) return;
        this.jobs = append ? [...this.jobs, ...response.jobs] : response.jobs;
        this.total = response.total;
        this.page = response.page;
        this.hasMore = response.hasMore;
      } catch (error) {
        if (controller.signal.aborted) return;
        this.error = error instanceof Error ? error.message : 'Failed to load jobs';
      } finally {
        if (requestSequence === jobsRequestSequence) this.loading = false;
      }
    },
    async fetchJob(id: string) {
      const response = await apiFetch<{ job: Job }>(`/jobs/${id}`);
      this.selectedJob = response.job;
      return response.job;
    },
    async updateJobStatus(id: string, status: JobStatus) {
      const response = await apiFetch<{ job: Job }>(`/jobs/${id}`, {
        method: 'PATCH',
        body: { status },
      });

      this.selectedJob = response.job;
      this.jobs = this.jobs.filter((job) => job.id !== id);
      return response.job;
    },
    async fetchSyncStatus() {
      const response = await apiFetch<{ runs: IngestRun[] }>('/jobs/sync-status');
      this.syncRuns = response.runs;
    },
    async refreshSources(sources: string[]) {
      this.refreshing = true;
      this.error = null;

      try {
        for (const source of sources) {
          this.refreshProgress = source;
          await apiFetch('/ingest?source=' + encodeURIComponent(source), { method: 'POST' });
        }

        await this.fetchJobs();
        await this.fetchSyncStatus();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Refresh failed';
      } finally {
        this.refreshProgress = '';
        this.refreshing = false;
      }
    },
  },
});
