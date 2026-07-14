<script setup lang="ts">
import { RouterLink } from 'vue-router';

import { absoluteDate, relativeDate } from '@/lib/dates';
import type { Job } from '@/types/jobs';
import TagChip from './TagChip.vue';

const props = defineProps<{
  job: Job;
  saved: boolean;
  isNew: boolean;
}>();

const emit = defineEmits<{
  open: [id: string];
  save: [id: string];
  dismiss: [id: string];
}>();

function locationLabel(job: Job): string {
  return job.location || 'Location unverified';
}

function warningLabel(warning: string): string {
  const labels: Record<string, string> = {
    'remote-region-unverified': 'Verify remote region',
    'location-unverified': 'Verify location',
    'workplace-unverified': 'Verify work mode',
    'employment-type-unverified': 'Verify employment type',
    'also-offers-part-time': 'Also offers part-time',
    'seniority-unverified': 'Verify seniority',
    'publication-date-unverified': 'Publication date unknown',
    'asks-7-plus-years': 'Asks for 7+ years',
    'technology-unclassified': 'Technology unclassified',
    'german-mentioned-not-required': 'German mentioned',
    'listing-language-unverified': 'Verify listing language',
  };
  if (warning.startsWith('outside-profile-')) {
    return `Outside target: ${warning.slice('outside-profile-'.length).replaceAll('-', ' ')}`;
  }
  return labels[warning] ?? warning.replaceAll('-', ' ');
}

function fitLabel(label: Job['fit']['label']): string {
  const labels: Record<Job['fit']['label'], string> = {
    strong: 'Strong fit',
    possible: 'Possible fit',
    stretch: 'Stretch',
    unrated: 'Profile needed',
  };
  return labels[label];
}

const jobRoute = {
  path: `/jobs/${props.job.id}`,
  query: props.job.sources[0] ? { source: props.job.sources[0] } : undefined,
};
</script>

<template>
  <article class="job-card">
    <RouterLink
      class="job-card-hitbox"
      :to="jobRoute"
      :aria-label="`Review ${job.title} at ${job.company}`"
      @click="emit('open', job.id)"
    />

    <div class="job-card-main">
      <div class="job-heading">
        <div class="job-state-row">
          <span v-if="isNew" class="job-state-label">New</span>
          <span class="fit-label" :class="`is-${job.fit.label}`">{{ fitLabel(job.fit.label) }}</span>
          <span class="eligibility-label">
            {{ job.profile_eligible ? 'Target match' : 'Outside target' }}
          </span>
        </div>
        <h2 class="job-title">{{ job.title }}</h2>
        <p class="job-company">{{ job.company }}</p>
      </div>
      <time class="job-age" :datetime="job.posted_at ?? job.first_seen_at" :title="absoluteDate(job.posted_at ?? job.first_seen_at)">
        {{ relativeDate(job.posted_at ?? job.first_seen_at) }}
      </time>
    </div>

    <div class="chip-row job-metadata">
      <TagChip :label="locationLabel(job)" />
      <TagChip :label="job.workplace" />
      <TagChip v-for="technology in job.technologies" :key="technology" :label="technology" />
      <TagChip
        v-for="employmentType in job.employment_types"
        :key="employmentType"
        :label="employmentType"
        tone="muted"
      />
      <TagChip v-for="source in job.sources" :key="source" :label="source" tone="muted" />
    </div>

    <p v-if="job.fit.reasons.length" class="job-fit-preview">
      {{ job.fit.reasons.slice(0, 2).join(' · ') }}
    </p>

    <p v-if="job.eligibility_warnings.length" class="job-warnings">
      {{ job.eligibility_warnings.slice(0, 3).map(warningLabel).join(' · ') }}
    </p>

    <div class="job-card-footer">
      <span class="source-count">
        {{ job.sources.length }} {{ job.sources.length === 1 ? 'source' : 'sources' }}
      </span>
      <div class="action-row">
        <button
          class="job-action job-action--secondary"
          :class="{ 'is-selected': saved }"
          type="button"
          :aria-pressed="saved"
          @click="emit('save', job.id)"
        >
          {{ saved ? 'Saved' : 'Save' }}
        </button>
        <button class="job-action job-action--quiet" type="button" @click="emit('dismiss', job.id)">Dismiss</button>
        <a class="job-action job-action--primary" :href="job.apply_url ?? job.url" target="_blank" rel="noreferrer">
          Apply
        </a>
      </div>
    </div>
  </article>
</template>
