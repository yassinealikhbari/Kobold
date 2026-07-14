import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import type {
  DiscoveryIssue,
  EmploymentType,
  InboxView,
  Job,
  JobStatus,
  SourceCoverage,
  Technology,
} from '@/types/jobs';

export type JobFilters = {
  q: string;
  workplace: '' | Job['workplace'];
  locationScope: '' | 'berlin' | 'germany' | 'remote-europe' | 'remote-worldwide' | 'unverified';
  source: string;
  technology: '' | Technology;
  employmentType: '' | EmploymentType;
  sort: 'posted' | 'score';
};

export type LocalJobState = {
  seen: boolean;
  saved: boolean;
  dismissed: boolean;
};

type JobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  issues?: DiscoveryIssue[];
  coverage?: SourceCoverage[];
  fetchedAt?: string;
  cache?: { hit: boolean; expires_at: string | null };
};

let activeJobsRequest: AbortController | null = null;
let jobsRequestSequence = 0;

export const SOURCE_NAMES = [
  'arbeitnow',
  'vuejobs',
  'berlinstartupjobs',
  'workingnomads',
  'remoteok',
  'remotive',
  'weworkremotely',
  'himalayas',
  'greenhouse',
  'lever',
  'ashby',
];

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    jobs: [] as Job[],
    selectedJob: null as Job | null,
    coverage: [] as SourceCoverage[],
    issues: [] as DiscoveryIssue[],
    total: 0,
    loading: false,
    refreshing: false,
    error: null as string | null,
    fetchedAt: null as string | null,
    cacheHit: false,
    view: 'new' as InboxView,
    dismissedJobIds: readStoredIds('kobold-dismissed-jobs'),
    savedJobIds: readStoredIds('kobold-saved-jobs'),
    seenJobIds: readStoredIds('kobold-seen-jobs'),
    filters: {
      q: '',
      workplace: '',
      locationScope: '',
      source: '',
      technology: '',
      employmentType: '',
      sort: 'posted',
    } as JobFilters,
  }),
  getters: {
    availableSources: (state): string[] => {
      const liveSources = state.coverage.map((source) => source.source);
      return liveSources.length > 0 ? liveSources : SOURCE_NAMES;
    },
    inboxCounts: (state): Record<InboxView, number> => {
      const active = state.jobs.filter((job) => !state.dismissedJobIds.includes(job.id));
      return {
        new: active.filter((job) => !state.seenJobIds.includes(job.id)).length,
        all: active.length,
        saved: active.filter((job) => state.savedJobIds.includes(job.id)).length,
      };
    },
    currentViewTotal: (state): number => jobsForView(state).length,
    activeFilterCount: (state): number =>
      [
        state.filters.q,
        state.filters.workplace,
        state.filters.locationScope,
        state.filters.source,
        state.filters.technology,
        state.filters.employmentType,
      ].filter(Boolean).length,
    filteredJobs: (state): Job[] => {
      const query = state.filters.q.trim().toLowerCase();
      return jobsForView(state)
        .filter((job) => {
          if (!query) return true;
          return [
            job.title,
            job.company,
            job.location ?? '',
            job.technologies.join(' '),
            job.tags.join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        })
        .filter((job) => !state.filters.workplace || job.workplace === state.filters.workplace)
        .filter((job) => !state.filters.locationScope || matchesLocationScope(job, state.filters.locationScope))
        .filter((job) => !state.filters.source || job.sources.includes(state.filters.source))
        .filter((job) => !state.filters.technology || job.technologies.includes(state.filters.technology))
        .filter(
          (job) => !state.filters.employmentType || job.employment_types.includes(state.filters.employmentType),
        )
        .sort((left, right) => {
          if (state.filters.sort === 'score') {
            return right.score - left.score || comparePostedAt(left, right);
          }
          return comparePostedAt(left, right);
        });
    },
  },
  actions: {
    async fetchJobs(options: { forceRefresh?: boolean } = {}) {
      activeJobsRequest?.abort();
      const controller = new AbortController();
      activeJobsRequest = controller;
      const requestSequence = ++jobsRequestSequence;
      this.loading = this.jobs.length === 0;
      this.error = null;

      try {
        const params = new URLSearchParams({ page: '1', pageSize: '500', sort: 'posted' });
        if (options.forceRefresh) params.set('refresh', '1');
        const response = await apiFetch<JobsResponse>(`/jobs?${params.toString()}`, { signal: controller.signal });
        if (requestSequence !== jobsRequestSequence) return;

        this.jobs = response.jobs;
        this.total = response.total;
        this.coverage = response.coverage ?? [];
        this.issues = response.issues ?? [];
        this.fetchedAt = response.fetchedAt ?? new Date().toISOString();
        this.cacheHit = response.cache?.hit ?? false;
        if (response.hasMore) {
          this.error = `KOBOLD returned the first ${response.pageSize} eligible jobs. Narrow the search profile.`;
        }
        if (this.selectedJob) {
          this.selectedJob = response.jobs.find((job) => job.id === this.selectedJob?.id) ?? this.selectedJob;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        this.error = error instanceof Error ? error.message : 'Failed to load jobs';
      } finally {
        if (requestSequence === jobsRequestSequence) this.loading = false;
      }
    },
    async fetchJob(id: string, source?: string) {
      const cached = this.jobs.find((job) => job.id === id);
      if (cached) {
        this.selectedJob = cached;
        this.markSeen(id);
        return cached;
      }

      const params = new URLSearchParams();
      if (source) params.set('source', source);
      const suffix = params.size > 0 ? `?${params.toString()}` : '';
      const response = await apiFetch<{ job: Job }>(`/jobs/${id}${suffix}`);
      this.selectedJob = response.job;
      this.markSeen(id);
      return response.job;
    },
    async updateJobStatus(id: string, status: JobStatus) {
      if (status === 'dismissed') this.dismissJob(id);
    },
    markSeen(id: string) {
      if (this.seenJobIds.includes(id)) return;
      this.seenJobIds.push(id);
      storeIds('kobold-seen-jobs', this.seenJobIds);
    },
    localStateFor(id: string): LocalJobState {
      return {
        seen: this.seenJobIds.includes(id),
        saved: this.savedJobIds.includes(id),
        dismissed: this.dismissedJobIds.includes(id),
      };
    },
    restoreLocalState(id: string, state: LocalJobState) {
      this.seenJobIds = withMembership(this.seenJobIds, id, state.seen);
      this.savedJobIds = withMembership(this.savedJobIds, id, state.saved);
      this.dismissedJobIds = withMembership(this.dismissedJobIds, id, state.dismissed);
      storeIds('kobold-seen-jobs', this.seenJobIds);
      storeIds('kobold-saved-jobs', this.savedJobIds);
      storeIds('kobold-dismissed-jobs', this.dismissedJobIds);
    },
    toggleSaved(id: string): boolean {
      this.markSeen(id);
      if (this.savedJobIds.includes(id)) {
        this.savedJobIds = this.savedJobIds.filter((savedId) => savedId !== id);
        storeIds('kobold-saved-jobs', this.savedJobIds);
        return false;
      }

      this.savedJobIds.push(id);
      storeIds('kobold-saved-jobs', this.savedJobIds);
      return true;
    },
    saveJobLocally(id: string) {
      if (!this.savedJobIds.includes(id)) this.toggleSaved(id);
    },
    dismissJob(id: string) {
      this.markSeen(id);
      if (!this.dismissedJobIds.includes(id)) this.dismissedJobIds.push(id);
      this.savedJobIds = this.savedJobIds.filter((savedId) => savedId !== id);
      storeIds('kobold-dismissed-jobs', this.dismissedJobIds);
      storeIds('kobold-saved-jobs', this.savedJobIds);
      if (this.selectedJob?.id === id) this.selectedJob = null;
    },
    restoreDismissed(id: string) {
      this.dismissedJobIds = this.dismissedJobIds.filter((dismissedId) => dismissedId !== id);
      storeIds('kobold-dismissed-jobs', this.dismissedJobIds);
    },
    clearFilters() {
      this.filters.q = '';
      this.filters.workplace = '';
      this.filters.locationScope = '';
      this.filters.source = '';
      this.filters.technology = '';
      this.filters.employmentType = '';
      this.filters.sort = 'posted';
    },
    async refreshSources() {
      this.refreshing = true;
      try {
        await this.fetchJobs({ forceRefresh: true });
      } finally {
        this.refreshing = false;
      }
    },
  },
});

function jobsForView(state: {
  jobs: Job[];
  view: InboxView;
  dismissedJobIds: string[];
  savedJobIds: string[];
  seenJobIds: string[];
}): Job[] {
  const active = state.jobs.filter((job) => !state.dismissedJobIds.includes(job.id));
  if (state.view === 'new') return active.filter((job) => !state.seenJobIds.includes(job.id));
  if (state.view === 'saved') return active.filter((job) => state.savedJobIds.includes(job.id));
  return active;
}

function matchesLocationScope(job: Job, scope: JobFilters['locationScope']): boolean {
  const location = job.location ?? '';
  if (scope === 'berlin') return /\bberlin\b/i.test(location);
  if (scope === 'germany') {
    return /\b(?:germany|deutschland|berlin|hamburg|munich|m[üu]nchen|cologne|k[öo]ln|frankfurt|stuttgart|d[üu]sseldorf|leipzig|dresden|bremen|hannover|deu?)\b/i.test(
      location,
    );
  }
  if (scope === 'remote-europe') {
    return (
      (job.workplace === 'remote' || job.workplace === 'hybrid') &&
      /\b(?:europe|eu|emea|cet|cest|dach|germany|deutschland)\b/i.test(location)
    );
  }
  if (scope === 'remote-worldwide') {
    return job.workplace === 'remote' && /\b(?:worldwide|anywhere|global|all countries)\b/i.test(location);
  }
  if (scope === 'unverified') {
    return job.eligibility_warnings.some((warning) => /location|region|workplace/.test(warning));
  }
  return true;
}

function comparePostedAt(left: Job, right: Job): number {
  const leftTime = Date.parse(left.posted_at ?? '') || Number.NEGATIVE_INFINITY;
  const rightTime = Date.parse(right.posted_at ?? '') || Number.NEGATIVE_INFINITY;
  return rightTime - leftTime || left.id.localeCompare(right.id);
}

function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function storeIds(key: string, ids: string[]): void {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
}

function withMembership(ids: string[], id: string, included: boolean): string[] {
  const withoutId = ids.filter((candidate) => candidate !== id);
  return included ? [...withoutId, id] : withoutId;
}
