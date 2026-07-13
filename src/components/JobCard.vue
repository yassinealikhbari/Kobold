<script setup lang="ts">
import { RouterLink } from 'vue-router';

import { absoluteDate, relativeDate } from '@/lib/dates';
import type { Job } from '@/types/jobs';

defineProps<{
  job: Job;
}>();

const emit = defineEmits<{
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

    <div class="job-card-footer">
      <span :title="absoluteDate(job.posted_at ?? job.first_seen_at)">
        {{ relativeDate(job.posted_at ?? job.first_seen_at) }}
      </span>
      <div class="action-row">
        <RouterLink class="text-button" :to="`/jobs/${job.id}`">Save</RouterLink>
        <button class="text-button" type="button" @click="emit('dismiss', job.id)">Dismiss</button>
        <a class="text-button" :href="job.url" target="_blank" rel="noreferrer">Open listing</a>
      </div>
    </div>
  </article>
</template>
