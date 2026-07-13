<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import FilterBar from '@/components/FilterBar.vue';
import JobCard from '@/components/JobCard.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { apiFetch } from '@/lib/api';
import { SOURCES, useJobsStore } from '@/stores/jobs';

const jobs = useJobsStore();
const refreshSelection = ref('all');
let filterTimer: number | undefined;

const activeFilters = computed(() => {
  const filters: string[] = [];
  if (jobs.filters.q) filters.push(`Search: ${jobs.filters.q}`);
  if (jobs.filters.workplace) filters.push(jobs.filters.workplace);
  if (jobs.filters.source) filters.push(jobs.filters.source);
  if (jobs.filters.minScore === 6) filters.push('Best matches');
  if (jobs.filters.minScore === 3) filters.push('Good matches');
  if (jobs.filters.showStale) filters.push('Including stale');
  return filters;
});

function scheduleFetch() {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    void jobs.fetchJobs();
  }, 250);
}

async function dismiss(id: string) {
  await jobs.updateJobStatus(id, 'dismissed');
}

async function save(id: string) {
  await apiFetch('/applications', {
    method: 'POST',
    body: { job_id: id },
  });
  await jobs.fetchJobs();
}

function resetFilters() {
  jobs.filters.q = '';
  jobs.filters.workplace = '';
  jobs.filters.source = '';
  jobs.filters.minScore = -3;
  jobs.filters.showStale = false;
  jobs.filters.sort = 'score';
}

function clearFilters() {
  resetFilters();
  void jobs.fetchJobs();
}

function applyQuickFilter(filter: 'best' | 'remote' | 'berlin' | 'all') {
  resetFilters();
  if (filter === 'best') jobs.filters.minScore = 6;
  if (filter === 'remote') jobs.filters.workplace = 'remote';
  if (filter === 'berlin') jobs.filters.q = 'Berlin';
  void jobs.fetchJobs();
}

async function refresh() {
  const selectedSources = refreshSelection.value === 'all' ? SOURCES : [refreshSelection.value];
  await jobs.refreshSources(selectedSources);
}

onMounted(async () => {
  await Promise.all([jobs.fetchJobs(), jobs.fetchSyncStatus()]);
});
</script>

<template>
  <section class="page">
    <header class="page-header board-header">
      <div>
        <p class="eyebrow">Jobs</p>
        <h1>Board</h1>
      </div>

      <div class="header-actions">
        <SyncStatus :runs="jobs.syncRuns" :refreshing="jobs.refreshing" :progress="jobs.refreshProgress" />
        <select v-model="refreshSelection" aria-label="Refresh source">
          <option value="all">All sources</option>
          <option v-for="source in SOURCES" :key="source" :value="source">{{ source }}</option>
        </select>
        <button type="button" :disabled="jobs.refreshing" @click="refresh">
          {{ jobs.refreshing ? 'Refreshing' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="board-controls">
      <FilterBar :filters="jobs.filters" :loading="jobs.loading" @change="scheduleFetch" />
      <div class="quick-filters" aria-label="Quick filters">
        <button type="button" class="text-button" @click="applyQuickFilter('best')">Best matches</button>
        <button type="button" class="text-button" @click="applyQuickFilter('remote')">Remote</button>
        <button type="button" class="text-button" @click="applyQuickFilter('berlin')">Berlin</button>
        <button type="button" class="text-button" @click="clearFilters">Clear filters</button>
      </div>
      <div v-if="activeFilters.length" class="active-filters" aria-label="Active filters">
        <span v-for="filter in activeFilters" :key="filter" class="chip muted">{{ filter }}</span>
      </div>
    </div>

    <p v-if="jobs.error" class="form-error">{{ jobs.error }}</p>

    <div v-if="jobs.loading" class="panel">Loading jobs...</div>
    <div v-else-if="jobs.jobs.length === 0" class="panel empty-state">
      <p>No matching jobs.</p>
      <p v-if="jobs.syncRuns[0]" class="subtle">
        Last run: {{ jobs.syncRuns[0].source }} found {{ jobs.syncRuns[0].found }},
        matched {{ jobs.syncRuns[0].matched }}, added {{ jobs.syncRuns[0].inserted }} active
        <template v-if="jobs.syncRuns[0].inserted_dismissed"> and {{ jobs.syncRuns[0].inserted_dismissed }} dismissed</template>.
      </p>
      <p v-if="jobs.syncRuns[0]?.error" class="form-error">{{ jobs.syncRuns[0].error }}</p>
      <button type="button" class="empty-action" @click="clearFilters">Clear filters</button>
    </div>
    <div v-else class="job-list">
      <div class="result-count">{{ jobs.total }} matching jobs</div>
      <JobCard v-for="job in jobs.jobs" :key="job.id" :job="job" @save="save" @dismiss="dismiss" />
      <button v-if="jobs.hasMore" type="button" :disabled="jobs.loading" @click="jobs.fetchJobs({ append: true })">
        {{ jobs.loading ? 'Loading' : 'Load more jobs' }}
      </button>
    </div>
  </section>
</template>
