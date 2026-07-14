<script setup lang="ts">
import DOMPurify from 'dompurify';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import ApplyPanel from '@/components/ApplyPanel.vue';
import { absoluteDate } from '@/lib/dates';
import { useJobsStore } from '@/stores/jobs';

const route = useRoute();
const router = useRouter();
const jobs = useJobsStore();
const applicationOpened = ref(false);

const sanitizedDescription = computed(() => {
  const html = jobs.selectedJob?.description_html;
  return html ? DOMPurify.sanitize(html) : '';
});

const matchLevel = computed(() => {
  const score = jobs.selectedJob?.score ?? 0;
  if (score >= 6) return 'Best match';
  if (score >= 3) return 'Good match';
  return 'Eligible match';
});

const matchReasons = computed(() => jobs.selectedJob?.score_reasons ?? []);
const isSaved = computed(() => Boolean(jobs.selectedJob && jobs.savedJobIds.includes(jobs.selectedJob.id)));

const needsLocationVerification = computed(
  () => !jobs.selectedJob?.location || jobs.selectedJob.workplace === 'unknown',
);

const jobFacts = computed(() => {
  const job = jobs.selectedJob;
  if (!job) return [];

  return [
    { label: 'Location', value: job.location },
    { label: 'Workplace', value: job.workplace === 'unknown' ? null : job.workplace },
    { label: 'Seniority', value: job.seniority },
    { label: 'Salary', value: job.salary_text },
    { label: 'Posted', value: absoluteDate(job.posted_at ?? job.first_seen_at) },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
});

async function dismiss() {
  if (!jobs.selectedJob) return;
  await jobs.updateJobStatus(jobs.selectedJob.id, 'dismissed');
  await router.push('/');
}

function openApplication() {
  applicationOpened.value = true;
}

function saveForLater() {
  if (jobs.selectedJob) jobs.toggleSaved(jobs.selectedJob.id);
}

function refreshJob() {
  if (typeof route.params.id === 'string') {
    const source = typeof route.query.source === 'string' ? route.query.source : undefined;
    void jobs.fetchJob(route.params.id, source);
  }
}

onMounted(async () => {
  if (typeof route.params.id === 'string') {
    const source = typeof route.query.source === 'string' ? route.query.source : undefined;
    await jobs.fetchJob(route.params.id, source);
  }
});
</script>

<template>
  <section v-if="jobs.selectedJob" class="page job-detail-page">
    <header class="page-header job-detail-header">
      <RouterLink class="back-link" to="/">Back to board</RouterLink>
      <p class="eyebrow">Job</p>
      <h1>{{ jobs.selectedJob.title }}</h1>
      <p class="subtle">{{ jobs.selectedJob.company }}</p>
    </header>

    <div class="decision-bar" aria-label="Job actions">
      <div class="match-summary">
        <strong>{{ matchLevel }} · {{ jobs.selectedJob.score }}/12</strong>
        <span>{{ jobs.selectedJob.location || 'Verify location before applying' }}</span>
      </div>
      <div class="action-row">
        <a
          class="job-action job-action--primary"
          :href="jobs.selectedJob.apply_url ?? jobs.selectedJob.url"
          target="_blank"
          rel="noreferrer"
          @click="openApplication"
        >
          Apply now
        </a>
        <button type="button" class="job-action" :class="{ 'is-selected': isSaved }" @click="saveForLater">
          {{ isSaved ? 'Saved' : 'Save' }}
        </button>
        <button type="button" class="job-action job-action--quiet" @click="dismiss">Dismiss</button>
      </div>
    </div>

    <div class="job-workspace">
      <div class="job-review">
        <section class="panel match-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Match review</p>
              <h2>Why this job</h2>
            </div>
            <span class="match-score">{{ jobs.selectedJob.score }}/12</span>
          </div>

          <ul v-if="matchReasons.length" class="match-reasons">
            <li v-for="reason in matchReasons" :key="reason">{{ reason }}</li>
          </ul>
          <p v-else class="subtle">Score details will be available after this listing is refreshed.</p>

          <p v-if="needsLocationVerification" class="form-hint">
            Verify the work location in the original listing before you apply.
          </p>
        </section>

        <section v-if="jobFacts.length" class="panel facts-panel">
          <p class="eyebrow">Known details</p>
          <dl class="job-facts">
            <div v-for="fact in jobFacts" :key="fact.label">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel description-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Original listing</p>
              <h2>Description</h2>
            </div>
            <span class="source-label">{{ jobs.selectedJob.sources.join(', ') }}</span>
          </div>
          <div v-if="sanitizedDescription" class="job-description" v-html="sanitizedDescription"></div>
          <p v-else class="pre-wrap">{{ jobs.selectedJob.description_text || 'No description available.' }}</p>
        </section>
      </div>

      <aside class="job-prep">
        <ApplyPanel
          :job="jobs.selectedJob"
          :application-opened="applicationOpened"
          :saved="isSaved"
          @application-change="refreshJob"
          @save="saveForLater"
        />
      </aside>
    </div>
  </section>

  <section v-else class="page">
    <div class="panel">Loading job...</div>
  </section>
</template>
