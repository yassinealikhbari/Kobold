<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import {
  daysInStage,
  formatMoney,
  OPPORTUNITY_STAGES,
  pipelineTotals,
  sortOpportunitiesByFix,
} from '@/lib/pipeline';
import { useCrmStore } from '@/stores/crm';
import { useOpportunitiesStore } from '@/stores/opportunities';
import type {
  OpportunityDraft,
  OpportunityLostReason,
  OpportunityStage,
  OrganizationStatus,
} from '@/types/crm';

const crm = useCrmStore();
const pipeline = useOpportunitiesStore();
const draggedId = ref('');
const organizationFilter = ref('');
const statusFilter = ref<OrganizationStatus | ''>('');
const fixKeyword = ref('');
const pendingLostId = ref('');
const pendingLostReason = ref<OpportunityLostReason>('no response');
const draft = reactive<OpportunityDraft>({
  organization_id: '',
  title: '',
  value_cents: null,
  currency: 'EUR',
  confidence: null,
  expected_close: null,
});

const visibleOpportunities = computed(() =>
  pipeline.opportunities.filter((item) => {
    if (organizationFilter.value && item.organization_id !== organizationFilter.value) return false;
    if (statusFilter.value && item.organization?.status !== statusFilter.value) return false;
    const needle = fixKeyword.value.trim().toLowerCase();
    if (needle && !(item.organization?.missing_function ?? '').toLowerCase().includes(needle)) return false;
    return true;
  }),
);
const hasActiveFilters = computed(
  () => Boolean(organizationFilter.value) || Boolean(statusFilter.value) || Boolean(fixKeyword.value.trim()),
);

function clearPipelineFilters() {
  organizationFilter.value = '';
  statusFilter.value = '';
  fixKeyword.value = '';
}
const byStage = computed(() =>
  OPPORTUNITY_STAGES.reduce(
    (groups, stage) => {
      groups[stage] = sortOpportunitiesByFix(
        visibleOpportunities.value.filter((item) => item.stage === stage),
      );
      return groups;
    },
    {} as Record<OpportunityStage, typeof pipeline.opportunities>,
  ),
);
const totals = computed(() => pipelineTotals(visibleOpportunities.value));

async function createOpportunity() {
  const opportunity = await pipeline.createOpportunity({
    ...draft,
    value_cents: draft.value_cents === null ? null : Number(draft.value_cents),
    confidence: draft.confidence === null ? null : Number(draft.confidence),
  });
  if (!opportunity) return;
  draft.title = '';
  draft.value_cents = null;
  draft.confidence = null;
  draft.expected_close = null;
}

function dragStart(id: string) {
  draggedId.value = id;
}

function drop(stage: OpportunityStage) {
  const id = draggedId.value;
  draggedId.value = '';
  if (id) requestMove(id, stage);
}

function requestMove(id: string, stage: OpportunityStage) {
  if (stage === 'lost') {
    pendingLostId.value = id;
    return;
  }
  void pipeline.moveOpportunity(id, stage);
}

async function confirmLost() {
  if (!pendingLostId.value) return;
  const id = pendingLostId.value;
  pendingLostId.value = '';
  await pipeline.moveOpportunity(id, 'lost', pendingLostReason.value);
}

onMounted(() => {
  void Promise.all([pipeline.fetchOpportunities(), crm.fetchOrganizations()]);
});
</script>

<template>
  <section class="page pipeline-page" :aria-busy="pipeline.loading">
    <PageHeader
      eyebrow="Freelance"
      title="Pipeline"
      description="Move paid work from first lead to a clear outcome."
    />

    <p v-if="pipeline.error" class="form-error" role="alert">{{ pipeline.error }}</p>

    <div class="pipeline-filter-row">
      <label class="pipeline-filter">
        Filter by organization
        <select v-model="organizationFilter">
          <option value="">All organizations</option>
          <option v-for="organization in crm.organizations" :key="organization.id" :value="organization.id">
            {{ organization.name }}
          </option>
        </select>
      </label>
      <label class="pipeline-filter">
        Organization status
        <select v-model="statusFilter">
          <option value="">Any status</option>
          <option value="prospect">New prospects</option>
          <option value="active">Active</option>
          <option value="dormant">Dormant</option>
          <option value="closed">Closed</option>
          <option value="disqualified">Disqualified</option>
        </select>
      </label>
      <label class="pipeline-filter">
        Fix contains
        <input v-model="fixKeyword" type="search" placeholder="e.g. booking, mobile, impressum" />
      </label>
      <button v-if="hasActiveFilters" type="button" class="text-button" @click="clearPipelineFilters">
        Clear filters
      </button>
    </div>
    <p v-if="hasActiveFilters" class="subtle">
      Showing {{ visibleOpportunities.length }} of {{ pipeline.opportunities.length }} opportunities.
    </p>

    <section class="pipeline-metrics" aria-label="Pipeline totals">
      <div>
        <span>Open value</span>
        <strong>{{ formatMoney(totals.openValueCents) }}</strong>
      </div>
      <div>
        <span>Weighted value</span>
        <strong>{{ formatMoney(totals.weightedValueCents) }}</strong>
      </div>
      <div>
        <span>Open opportunities</span>
        <strong>{{ visibleOpportunities.filter((item) => !['won', 'lost'].includes(item.stage)).length }}</strong>
      </div>
    </section>

    <form class="panel pipeline-create" @submit.prevent="createOpportunity">
      <label>
        Organization
        <select v-model="draft.organization_id" required>
          <option value="" disabled>Choose organization</option>
          <option v-for="organization in crm.organizations" :key="organization.id" :value="organization.id">
            {{ organization.name }}
          </option>
        </select>
        <span v-if="pipeline.fieldErrors.organization_id" class="field-error">
          {{ pipeline.fieldErrors.organization_id }}
        </span>
      </label>
      <label>
        Opportunity
        <input v-model="draft.title" required maxlength="200" placeholder="One-page site" />
        <span v-if="pipeline.fieldErrors.title" class="field-error">{{ pipeline.fieldErrors.title }}</span>
      </label>
      <label>
        Value in cents
        <input v-model.number="draft.value_cents" type="number" min="0" step="1" placeholder="250000" />
      </label>
      <label>
        Confidence %
        <input v-model.number="draft.confidence" type="number" min="0" max="100" step="1" />
      </label>
      <button type="submit" :disabled="pipeline.saving">{{ pipeline.saving ? 'Saving' : 'Add lead' }}</button>
    </form>

    <form v-if="pendingLostId" class="panel loss-reason-panel" @submit.prevent="confirmLost">
      <div>
        <h2>Why was it lost?</h2>
        <p class="subtle">The reason is required and remains reportable.</p>
      </div>
      <label>
        Loss reason
        <select v-model="pendingLostReason">
          <option value="no budget">No budget</option>
          <option value="no response">No response</option>
          <option value="timing">Timing</option>
          <option value="chose someone else">Chose someone else</option>
          <option value="not a fit">Not a fit</option>
          <option value="business closed">Business closed</option>
        </select>
      </label>
      <div class="action-row">
        <button type="submit">Move to lost</button>
        <button type="button" class="text-button" @click="pendingLostId = ''">Cancel</button>
      </div>
    </form>

    <div v-if="pipeline.loading" class="panel board-loading" role="status">Loading pipeline...</div>
    <EmptyState
      v-else-if="pipeline.opportunities.length === 0"
      title="No opportunities yet"
      description="Add the first lead above. It will appear in the lead column."
    />
    <section v-else class="opportunity-board" aria-label="Opportunity pipeline">
      <p class="sr-only">
        Opportunities can be dragged between columns. A stage selector is also available on every card for keyboard use.
      </p>
      <section
        v-for="stage in OPPORTUNITY_STAGES"
        :key="stage"
        class="opportunity-column"
        :aria-labelledby="`pipeline-stage-${stage}`"
        @dragover.prevent
        @drop="drop(stage)"
      >
        <header class="kanban-heading">
          <h2 :id="`pipeline-stage-${stage}`">{{ stage }}</h2>
          <span>{{ totals.counts[stage] }}</span>
        </header>
        <article
          v-for="opportunity in byStage[stage]"
          :key="opportunity.id"
          class="opportunity-card"
          draggable="true"
          :aria-label="`${opportunity.title}, ${opportunity.organization?.name ?? 'unknown organization'}, ${opportunity.stage} stage`"
          @dragstart="dragStart(opportunity.id)"
        >
          <RouterLink :to="`/freelance/opportunities/${opportunity.id}`">
            <strong>{{ opportunity.title }}</strong>
            <span>{{ opportunity.organization?.name ?? 'Unknown organization' }}</span>
          </RouterLink>
          <div class="opportunity-evidence">
            <span>{{ formatMoney(opportunity.value_cents, opportunity.currency) }}</span>
            <span :class="{ 'is-stale': daysInStage(opportunity.stage_changed_at) > 14 }">
              {{ daysInStage(opportunity.stage_changed_at) }} days in stage
              <template v-if="daysInStage(opportunity.stage_changed_at) > 14"> · Needs follow-up</template>
            </span>
            <span>{{ opportunity.open_task_count ?? 0 }} open tasks</span>
          </div>
          <label>
            <span class="sr-only">Change stage for {{ opportunity.title }}</span>
            <select
              :value="opportunity.stage"
              @change="requestMove(opportunity.id, ($event.target as HTMLSelectElement).value as OpportunityStage)"
            >
              <option v-for="option in OPPORTUNITY_STAGES" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
        </article>
      </section>
    </section>
  </section>
</template>
