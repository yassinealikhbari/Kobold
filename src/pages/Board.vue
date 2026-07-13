<script setup lang="ts">
import { onMounted, ref } from 'vue';

import FilterBar from '@/components/FilterBar.vue';
import JobCard from '@/components/JobCard.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { apiFetch } from '@/lib/api';
import { SOURCES, useJobsStore } from '@/stores/jobs';

const jobs = useJobsStore();
const refreshSelection = ref('all');
let filterTimer: number | undefined;

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

    <FilterBar :filters="jobs.filters" :loading="jobs.loading" @change="scheduleFetch" />

    <p v-if="jobs.error" class="form-error">{{ jobs.error }}</p>

    <div v-if="jobs.loading" class="panel">Loading jobs...</div>
    <div v-else-if="jobs.jobs.length === 0" class="panel empty-state">
      <p>No matching jobs.</p>
      <p v-if="jobs.syncRuns[0]" class="subtle">
        Last run: {{ jobs.syncRuns[0].source }} found {{ jobs.syncRuns[0].found }},
        matched {{ jobs.syncRuns[0].matched }}, inserted {{ jobs.syncRuns[0].inserted }}.
      </p>
      <p v-if="jobs.syncRuns[0]?.error" class="form-error">{{ jobs.syncRuns[0].error }}</p>
    </div>
    <div v-else class="job-list">
      <div class="result-count">{{ jobs.total }} matching jobs</div>
      <JobCard v-for="job in jobs.jobs" :key="job.id" :job="job" @save="save" @dismiss="dismiss" />
    </div>
  </section>
</template>
