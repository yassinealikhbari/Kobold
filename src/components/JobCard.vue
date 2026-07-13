<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';

import { absoluteDate, relativeDate } from '@/lib/dates';
import type { Job } from '@/types/jobs';
import TagChip from './TagChip.vue';

const props = defineProps<{
  job: Job;
}>();

const router = useRouter();

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

function openJob() {
  void router.push(`/jobs/${props.job.id}`);
}
</script>

<template>
  <article class="job-card" role="link" tabindex="0" :aria-label="`Open ${job.title}`" @click="openJob" @keydown.enter="openJob" @keydown.space.prevent="openJob">
    <div class="job-card-main">
      <div>
        <h2 class="job-title">{{ job.title }}</h2>
        <p class="job-company">{{ job.company }}</p>
      </div>
      <span class="score-label">Match score <strong>{{ job.score }}</strong></span>
    </div>

    <div class="chip-row">
      <TagChip :label="locationBadge(job)" />
      <TagChip :label="job.workplace" />
      <TagChip v-if="job.status !== 'active'" :label="job.status" tone="warning" />
      <TagChip v-for="source in job.sources" :key="source" :label="source" tone="muted" />
    </div>

    <p v-if="job.score_reasons?.length" class="score-reasons">
      {{ job.score_reasons?.slice(0, 3).join(' · ') }}
    </p>

    <div class="job-card-footer">
      <span :title="absoluteDate(job.posted_at ?? job.first_seen_at)">
        {{ relativeDate(job.posted_at ?? job.first_seen_at) }}
      </span>
      <div class="action-row" @click.stop @keydown.stop>
        <RouterLink v-if="job.application" class="job-action job-action--secondary" to="/tracker">
          {{ job.application.status === 'applied' ? 'Applied' : 'Saved' }}
        </RouterLink>
        <button v-else class="job-action job-action--secondary" type="button" @click="emit('save', job.id)">Save</button>
        <button class="job-action job-action--secondary" type="button" @click="emit('dismiss', job.id)">Dismiss</button>
        <a class="job-action job-action--primary" :href="job.apply_url ?? job.url" target="_blank" rel="noreferrer">Apply</a>
      </div>
    </div>
  </article>
</template>
