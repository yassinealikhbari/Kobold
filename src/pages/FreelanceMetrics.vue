<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/pipeline';

type Metrics = {
  newLeadsPerWeek: Array<{ week: string; count: number }>;
  contactToConversationRate: number | null;
  proposalWinRate: number | null;
  averageDaysPerStage: Array<{ stage: string; days: number }>;
  pipelineValueOverTime: Array<{ at: string; values: Record<string, number> }>;
  lossReasons: Array<{ reason: string; count: number }>;
  currentPipelineByCurrency: Record<string, number>;
};

const metrics = ref<Metrics | null>(null);
const loading = ref(true);
const error = ref('');
const latestPipelinePoint = computed(
  () => metrics.value?.pipelineValueOverTime.at(-1)?.values ?? metrics.value?.currentPipelineByCurrency ?? {},
);

async function load() {
  try {
    const response = await apiFetch<{ metrics: Metrics }>('/metrics');
    metrics.value = response.metrics;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load metrics';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Metrics"
      description="Conversion and timing derived from immutable pipeline history."
    />
    <p v-if="error" class="form-error">{{ error }}</p>
    <div v-if="loading" class="panel board-loading">Calculating metrics...</div>
    <EmptyState
      v-else-if="!metrics"
      title="Metrics are unavailable"
      description="Apply the current migrations and record pipeline activity first."
    />
    <template v-else>
      <section class="metrics-grid">
        <article class="panel metric-card">
          <span>Contact → conversation</span>
          <strong>{{ metrics.contactToConversationRate === null ? '—' : `${metrics.contactToConversationRate}%` }}</strong>
        </article>
        <article class="panel metric-card">
          <span>Proposal win rate</span>
          <strong>{{ metrics.proposalWinRate === null ? '—' : `${metrics.proposalWinRate}%` }}</strong>
        </article>
        <article class="panel metric-card">
          <span>Pipeline now</span>
          <strong v-if="Object.keys(latestPipelinePoint).length">
            {{ Object.entries(latestPipelinePoint).map(([currency, cents]) => formatMoney(cents, currency)).join(' · ') }}
          </strong>
          <strong v-else>—</strong>
        </article>
      </section>

      <section class="metrics-details">
        <article class="panel form-section">
          <h2>New leads per week</h2>
          <div class="metric-rows">
            <div v-for="row in metrics.newLeadsPerWeek" :key="row.week">
              <span>{{ row.week }}</span><strong>{{ row.count }}</strong>
            </div>
          </div>
        </article>
        <article class="panel form-section">
          <h2>Average days per stage</h2>
          <div class="metric-rows">
            <div v-for="row in metrics.averageDaysPerStage" :key="row.stage">
              <span>{{ row.stage }}</span><strong>{{ row.days }}</strong>
            </div>
          </div>
        </article>
        <article class="panel form-section">
          <h2>Loss reasons</h2>
          <div class="metric-rows">
            <div v-for="row in metrics.lossReasons" :key="row.reason">
              <span>{{ row.reason }}</span><strong>{{ row.count }}</strong>
            </div>
            <p v-if="metrics.lossReasons.length === 0" class="subtle">No recorded losses.</p>
          </div>
        </article>
      </section>

      <section class="panel form-section export-panel">
        <h2>CSV exports</h2>
        <div class="action-row">
          <a v-for="entity in ['organizations', 'contacts', 'opportunities', 'activities']" :key="entity" class="button-link" :href="`/api/export?entity=${entity}`" download>
            {{ entity }}
          </a>
        </div>
      </section>
    </template>
  </section>
</template>

