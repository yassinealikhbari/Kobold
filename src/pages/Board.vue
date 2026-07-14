<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import FilterBar from '@/components/FilterBar.vue';
import JobCard from '@/components/JobCard.vue';
import { relativeDate } from '@/lib/dates';
import { useJobsStore } from '@/stores/jobs';
import type { LocalJobState } from '@/stores/jobs';
import type { InboxView, Job, SourceCoverage } from '@/types/jobs';

type BoardAction = {
  kind: 'dismissed' | 'saved' | 'unsaved';
  job: Job;
  previousState: LocalJobState;
};

const jobs = useJobsStore();
const coverageOpen = ref(false);
const lastAction = ref<BoardAction | null>(null);

const tabs: Array<{ id: InboxView; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'all', label: 'All' },
  { id: 'saved', label: 'Saved' },
];

const failedSources = computed(() => jobs.coverage.filter((source) => source.status === 'failed'));
const warningSources = computed(() => jobs.coverage.filter((source) => source.status === 'degraded'));
const sourceSummary = computed(() => {
  if (failedSources.value.length) return `${failedSources.value.length} failed`;
  if (warningSources.value.length) return `${warningSources.value.length} with warnings`;
  return `${jobs.coverage.length} checked`;
});

const resultLabel = computed(() => {
  const shown = jobs.filteredJobs.length;
  const total = jobs.currentViewTotal;
  return jobs.activeFilterCount > 0 && shown !== total ? `${shown} of ${total} jobs` : `${shown} jobs`;
});

const emptyTitle = computed(() => {
  if (jobs.jobs.length === 0) return 'No eligible jobs returned';
  if (jobs.activeFilterCount > 0 && jobs.filteredJobs.length === 0) return 'Filters hide every job';
  if (jobs.view === 'new') return 'Inbox reviewed';
  if (jobs.view === 'saved') return 'No saved jobs';
  return 'No jobs in this view';
});

const emptyBody = computed(() => {
  if (jobs.jobs.length === 0) return 'Open source coverage to see what each feed returned and why listings were excluded.';
  if (jobs.activeFilterCount > 0 && jobs.filteredJobs.length === 0) return 'Clear or loosen a filter to restore eligible jobs.';
  if (jobs.view === 'new') return 'Every current listing has been reviewed. New jobs will appear here after the next refresh.';
  if (jobs.view === 'saved') return 'Save a job from New or All to build a shortlist.';
  return 'Refresh the live sources to check for new listings.';
});

function openJob(id: string) {
  jobs.markSeen(id);
}

function dismiss(id: string) {
  const job = jobs.jobs.find((item) => item.id === id);
  if (!job) return;
  const previousState = jobs.localStateFor(id);
  jobs.dismissJob(id);
  lastAction.value = { kind: 'dismissed', job, previousState };
}

function save(id: string) {
  const job = jobs.jobs.find((item) => item.id === id);
  if (!job) return;
  const previousState = jobs.localStateFor(id);
  const saved = jobs.toggleSaved(id);
  lastAction.value = { kind: saved ? 'saved' : 'unsaved', job, previousState };
}

function undoLastAction() {
  const action = lastAction.value;
  if (!action) return;
  jobs.restoreLocalState(action.job.id, action.previousState);
  lastAction.value = null;
}

function topExclusion(source: SourceCoverage): string {
  const first = Object.entries(source.excluded).sort((left, right) => right[1] - left[1])[0];
  if (!first) return 'No exclusions';
  return `${first[1]} ${first[0].replaceAll('-', ' ')}`;
}

function showAll() {
  jobs.view = 'all';
}

onMounted(() => {
  void jobs.fetchJobs();
});
</script>

<template>
  <section class="page board-page">
    <header class="page-header board-header">
      <div>
        <p class="eyebrow">Discovery inbox</p>
        <h1>Board</h1>
        <p class="board-summary">
          <strong>{{ jobs.total }}</strong> eligible jobs
          <template v-if="jobs.coverage.length"> · {{ jobs.coverage.length }} sources</template>
          <template v-if="jobs.fetchedAt"> · updated {{ relativeDate(jobs.fetchedAt) }}</template>
        </p>
      </div>

      <button type="button" :disabled="jobs.refreshing" @click="jobs.refreshSources()">
        {{ jobs.refreshing ? 'Refreshing' : 'Refresh sources' }}
      </button>
    </header>

    <nav class="inbox-tabs" aria-label="Job inbox views">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="inbox-tab"
        :class="{ 'is-active': jobs.view === tab.id }"
        :aria-current="jobs.view === tab.id ? 'page' : undefined"
        @click="jobs.view = tab.id"
      >
        {{ tab.label }}
        <span>{{ jobs.inboxCounts[tab.id] }}</span>
      </button>
    </nav>

    <FilterBar
      :filters="jobs.filters"
      :sources="jobs.availableSources"
      :active-count="jobs.activeFilterCount"
      @clear="jobs.clearFilters"
    />

    <section class="coverage-section" aria-label="Source coverage">
      <button
        type="button"
        class="coverage-toggle"
        :class="{ 'has-errors': failedSources.length }"
        :aria-expanded="coverageOpen"
        @click="coverageOpen = !coverageOpen"
      >
        <span>Source coverage</span>
        <span>{{ sourceSummary }}</span>
      </button>

      <div v-if="coverageOpen" class="coverage-panel">
        <div class="coverage-heading">
          <strong>{{ jobs.total }} eligible unique jobs</strong>
          <span>Filters never refetch sources</span>
        </div>
        <div class="coverage-table" role="table" aria-label="Source results">
          <div class="coverage-row coverage-row--head" role="row">
            <span role="columnheader">Source</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Fetched</span>
            <span role="columnheader">Eligible</span>
            <span role="columnheader">Top exclusion</span>
          </div>
          <div v-for="source in jobs.coverage" :key="source.source" class="coverage-row" role="row">
            <strong role="cell">{{ source.source }}</strong>
            <span role="cell" class="coverage-status" :class="`is-${source.status}`">{{ source.status }}</span>
            <span role="cell">{{ source.fetched }}</span>
            <span role="cell">{{ source.returned }}</span>
            <span role="cell">{{ source.error || topExclusion(source) }}</span>
          </div>
        </div>
      </div>
    </section>

    <p v-if="jobs.error" class="form-error">{{ jobs.error }}</p>
    <p v-for="issue in jobs.issues" :key="`${issue.source}-${issue.error}`" class="source-issue" :class="`is-${issue.severity}`">
      <strong>{{ issue.source }}</strong> {{ issue.error }}
    </p>

    <div v-if="lastAction" class="action-feedback" role="status">
      <span>
        <strong>{{ lastAction.job.title }}</strong>
        {{ lastAction.kind === 'dismissed' ? 'dismissed' : lastAction.kind === 'saved' ? 'saved' : 'removed from saved' }}.
      </span>
      <button type="button" class="text-button" @click="undoLastAction">Undo</button>
    </div>

    <div v-if="jobs.loading" class="panel board-loading" aria-live="polite">Checking live sources...</div>
    <div v-else-if="jobs.filteredJobs.length === 0" class="panel empty-state">
      <h2>{{ emptyTitle }}</h2>
      <p class="subtle">{{ emptyBody }}</p>
      <div class="action-row">
        <button v-if="jobs.activeFilterCount" type="button" @click="jobs.clearFilters">Clear filters</button>
        <button v-else-if="jobs.view !== 'all' && jobs.jobs.length" type="button" @click="showAll">View all jobs</button>
        <button v-else type="button" @click="jobs.refreshSources()">Refresh sources</button>
      </div>
    </div>
    <div v-else class="job-list" :aria-busy="jobs.refreshing">
      <div class="result-heading">
        <span class="result-count">{{ resultLabel }}</span>
        <span v-if="jobs.view === 'new'">Unreviewed</span>
        <span v-else-if="jobs.view === 'saved'">Shortlist</span>
        <span v-else>Newest first</span>
      </div>
      <JobCard
        v-for="job in jobs.filteredJobs"
        :key="job.id"
        :job="job"
        :saved="jobs.savedJobIds.includes(job.id)"
        :is-new="!jobs.seenJobIds.includes(job.id)"
        @open="openJob"
        @save="save"
        @dismiss="dismiss"
      />
    </div>
  </section>
</template>
