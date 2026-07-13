<script setup lang="ts">
import { SOURCES, type JobFilters } from '@/stores/jobs';

defineProps<{
  filters: JobFilters;
  loading: boolean;
}>();

const emit = defineEmits<{
  change: [];
}>();
</script>

<template>
  <form class="filter-bar" @submit.prevent="emit('change')">
    <input
      v-model="filters.q"
      type="search"
      placeholder="Search jobs"
      aria-label="Search jobs"
      @input="emit('change')"
    />

    <select v-model="filters.workplace" aria-label="Workplace" @change="emit('change')">
      <option value="">Any workplace</option>
      <option value="remote">Remote</option>
      <option value="hybrid">Hybrid</option>
      <option value="onsite">Onsite</option>
      <option value="unknown">Unknown</option>
    </select>

    <select v-model="filters.source" aria-label="Source" @change="emit('change')">
      <option value="">Any source</option>
      <option v-for="source in SOURCES" :key="source" :value="source">{{ source }}</option>
    </select>

    <label class="inline-field">
      <span>Min score</span>
      <input v-model.number="filters.minScore" type="number" min="-3" max="12" @input="emit('change')" />
    </label>

    <select v-model="filters.sort" aria-label="Sort" @change="emit('change')">
      <option value="score">Score</option>
      <option value="posted">Posted</option>
    </select>

    <label class="check-field">
      <input v-model="filters.showStale" type="checkbox" @change="emit('change')" />
      <span>Show stale</span>
    </label>

    <button type="submit" :disabled="loading">Apply</button>
  </form>
</template>
