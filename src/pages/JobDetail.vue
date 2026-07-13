<script setup lang="ts">
import DOMPurify from 'dompurify';
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

import ApplyPanel from '@/components/ApplyPanel.vue';
import { absoluteDate } from '@/lib/dates';
import { useJobsStore } from '@/stores/jobs';

const route = useRoute();
const jobs = useJobsStore();

const sanitizedDescription = computed(() => {
  const html = jobs.selectedJob?.description_html;
  return html ? DOMPurify.sanitize(html) : '';
});

async function dismiss() {
  if (!jobs.selectedJob) return;
  await jobs.updateJobStatus(jobs.selectedJob.id, 'dismissed');
}

function refreshJob() {
  if (typeof route.params.id === 'string') {
    void jobs.fetchJob(route.params.id);
  }
}

onMounted(async () => {
  if (typeof route.params.id === 'string') {
    await jobs.fetchJob(route.params.id);
  }
});
</script>

<template>
  <section v-if="jobs.selectedJob" class="page">
    <header class="page-header">
      <p class="eyebrow">Job</p>
      <h1>{{ jobs.selectedJob.title }}</h1>
      <p class="subtle">{{ jobs.selectedJob.company }}</p>
    </header>

    <div class="detail-grid">
      <section class="panel detail-panel">
        <dl class="metadata-list">
          <div>
            <dt>Location</dt>
            <dd>{{ jobs.selectedJob.location || 'Unknown' }}</dd>
          </div>
          <div>
            <dt>Workplace</dt>
            <dd>{{ jobs.selectedJob.workplace }}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd>{{ jobs.selectedJob.score }} · {{ jobs.selectedJob.score_reasons.join(', ') || 'No score signals' }}</dd>
          </div>
          <div>
            <dt>Posted</dt>
            <dd>{{ absoluteDate(jobs.selectedJob.posted_at ?? jobs.selectedJob.first_seen_at) }}</dd>
          </div>
          <div>
            <dt>Sources</dt>
            <dd>{{ jobs.selectedJob.sources.join(', ') }}</dd>
          </div>
          <div>
            <dt>ATS</dt>
            <dd>{{ jobs.selectedJob.ats || 'Unknown' }}</dd>
          </div>
        </dl>

        <div class="action-row">
          <a class="button-link" :href="jobs.selectedJob.apply_url ?? jobs.selectedJob.url" target="_blank" rel="noreferrer">
            Open application form
          </a>
          <button type="button" @click="dismiss">Dismiss</button>
        </div>
      </section>

      <ApplyPanel :job="jobs.selectedJob" @applied="refreshJob" />
    </div>

    <section class="panel description-panel">
      <h2>Description</h2>
      <div v-if="sanitizedDescription" class="job-description" v-html="sanitizedDescription"></div>
      <p v-else class="pre-wrap">{{ jobs.selectedJob.description_text || 'No description available.' }}</p>
    </section>
  </section>

  <section v-else class="page">
    <div class="panel">Loading job...</div>
  </section>
</template>
