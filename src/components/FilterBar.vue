<script setup lang="ts">
import type { JobFilters } from '@/stores/jobs';

defineProps<{
  filters: JobFilters;
  sources: string[];
  activeCount: number;
}>();

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <form class="filter-bar" @submit.prevent>
    <label class="filter-field filter-search">
      <span>Search</span>
      <input v-model="filters.q" type="search" placeholder="Title, company, location" />
    </label>

    <label class="filter-field">
      <span>Technology</span>
      <select v-model="filters.technology">
        <option value="">All technologies</option>
        <option value="vue">Vue</option>
        <option value="nuxt">Nuxt</option>
        <option value="react">React</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Location</span>
      <select v-model="filters.locationScope">
        <option value="">All eligible locations</option>
        <option value="berlin">Berlin</option>
        <option value="germany">Germany</option>
        <option value="remote-europe">Remote Europe</option>
        <option value="remote-worldwide">Remote worldwide</option>
        <option value="unverified">Needs verification</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Work mode</span>
      <select v-model="filters.workplace">
        <option value="">Any mode</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="onsite">Onsite</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Employment</span>
      <select v-model="filters.employmentType">
        <option value="">All eligible types</option>
        <option value="full-time">Full-time</option>
        <option value="contract">Contract</option>
        <option value="freelance">Freelance</option>
        <option value="unknown">Unverified</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Source</span>
      <select v-model="filters.source">
        <option value="">All sources</option>
        <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Fit</span>
      <select v-model="filters.fitLabel">
        <option value="">Every fit</option>
        <option value="strong">Strong</option>
        <option value="possible">Possible</option>
        <option value="stretch">Stretch</option>
        <option value="unrated">Profile needed</option>
      </select>
    </label>

    <label class="filter-field">
      <span>Order</span>
      <select v-model="filters.sort">
        <option value="posted">Newest first</option>
        <option value="fit">Best fit</option>
      </select>
    </label>

    <button type="button" class="filter-clear" :disabled="activeCount === 0" @click="emit('clear')">
      Clear {{ activeCount || '' }}
    </button>
  </form>
</template>
