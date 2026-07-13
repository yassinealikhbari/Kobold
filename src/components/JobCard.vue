<script setup lang="ts">
import { RouterLink } from 'vue-router';

import { absoluteDate, relativeDate } from '@/lib/dates';
import type { Job } from '@/types/jobs';

defineProps<{
  job: Job;
}>();

const emit = defineEmits<{
  save: [id: string];
  dismiss: [id: string];
}>();

function locationBadge(job: Job): string {
  if (job.location?.toLowerCase().includes('berlin')) return 'Berlin';
  if (job.workplace === 'remote' && /(europe|emea|eu\b|cet|germany|deutschland)/i.test(job.location ?? '')) {
    return 'Remote EU';
  }
  if (job.workplace === 'remote') return 'region unverified';
  return job.location || 'location unknown';
}
</script>

<template>
  <article class="job-card">
    <div class="job-card-main">
      <div>
        <RouterLink class="job-title" :to="`/jobs/${job.id}`">{{ job.title }}</RouterLink>
        <p class="job-company">{{ job.company }}</p>
      </div>
      <span class="score-pill">Score {{ job.score }}</span>
    </div>

    <div class="chip-row">
      <span class="chip">{{ locationBadge(job) }}</span>
      <span class="chip">{{ job.workplace }}</span>
      <span v-if="job.status !== 'active'" class="chip warning">{{ job.status }}</span>
      <span v-for="source in job.sources" :key="source" class="chip muted">{{ source }}</span>
    </div>

    <p v-if="job.score_reasons?.length" class="score-reasons">
      {{ job.score_reasons?.slice(0, 3).join(' · ') }}
    </p>

    <div class="job-card-footer">
      <span :title="absoluteDate(job.posted_at ?? job.first_seen_at)">
        {{ relativeDate(job.posted_at ?? job.first_seen_at) }}
      </span>
      <div class="action-row">
        <RouterLink v-if="job.application" class="text-button" to="/tracker">
          {{ job.application.status === 'applied' ? 'Applied' : 'Saved' }}
        </RouterLink>
        <button v-else class="text-button" type="button" @click="emit('save', job.id)">Save</button>
        <button class="text-button" type="button" @click="emit('dismiss', job.id)">Dismiss</button>
        <a class="text-button apply-link" :href="job.apply_url ?? job.url" target="_blank" rel="noreferrer">Apply</a>
      </div>
    </div>
  </article>
</template>
