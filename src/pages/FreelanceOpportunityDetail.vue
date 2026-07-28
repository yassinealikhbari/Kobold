<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import ActivityTimeline from '@/components/ActivityTimeline.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntityDetailShell from '@/components/EntityDetailShell.vue';
import PageHeader from '@/components/PageHeader.vue';
import { daysInStage, formatMoney } from '@/lib/pipeline';
import { useCrmStore } from '@/stores/crm';
import { useOpportunitiesStore } from '@/stores/opportunities';
import type { OpportunityDraft } from '@/types/crm';

const route = useRoute();
const router = useRouter();
const crm = useCrmStore();
const pipeline = useOpportunitiesStore();
const id = String(route.params.id);
const draft = reactive<OpportunityDraft>({
  organization_id: '',
  title: '',
  stage: 'lead',
  value_cents: null,
  currency: 'EUR',
  confidence: null,
  expected_close: null,
  lost_reason: null,
});

watch(
  () => pipeline.selected,
  (opportunity) => {
    if (opportunity) Object.assign(draft, opportunity);
  },
  { immediate: true },
);

async function save() {
  await pipeline.updateOpportunity(id, {
    ...draft,
    value_cents: draft.value_cents === null ? null : Number(draft.value_cents),
    confidence: draft.confidence === null ? null : Number(draft.confidence),
  });
}

async function archive() {
  await pipeline.archiveOpportunity(id);
  if (!pipeline.error) await router.push('/freelance');
}

onMounted(() => {
  void Promise.all([pipeline.fetchOpportunity(id), crm.fetchOrganizations()]);
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Opportunity"
      :title="pipeline.selected?.title ?? 'Opportunity detail'"
      :description="pipeline.selected ? `${pipeline.selected.organization?.name ?? 'Unknown organization'} · ${daysInStage(pipeline.selected.stage_changed_at)} days in ${pipeline.selected.stage}` : undefined"
    />

    <p v-if="pipeline.error" class="form-error">{{ pipeline.error }}</p>
    <div v-if="pipeline.loading" class="panel board-loading">Loading opportunity...</div>
    <EmptyState
      v-else-if="!pipeline.selected"
      title="Opportunity not found"
      description="The opportunity may have been archived or the link is no longer valid."
    >
      <RouterLink class="button-link empty-action" to="/freelance">Back to pipeline</RouterLink>
    </EmptyState>

    <EntityDetailShell v-else>
      <form class="panel form-section" @submit.prevent="save">
        <div class="section-heading">
          <h2>Deal</h2>
          <span class="tag-chip">{{ formatMoney(pipeline.selected.value_cents, pipeline.selected.currency) }}</span>
        </div>
        <div class="form-grid">
          <label>
            Title
            <input v-model="draft.title" required maxlength="200" />
            <span v-if="pipeline.fieldErrors.title" class="field-error">{{ pipeline.fieldErrors.title }}</span>
          </label>
          <label>
            Organization
            <select v-model="draft.organization_id" required>
              <option v-for="organization in crm.organizations" :key="organization.id" :value="organization.id">
                {{ organization.name }}
              </option>
            </select>
          </label>
          <label>
            Stage
            <select v-model="draft.stage">
              <option value="lead">Lead</option>
              <option value="contacted">Contacted</option>
              <option value="conversation">Conversation</option>
              <option value="proposal">Proposal</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <label v-if="draft.stage === 'lost'">
            Loss reason
            <select v-model="draft.lost_reason" required>
              <option :value="null" disabled>Choose reason</option>
              <option value="no budget">No budget</option>
              <option value="no response">No response</option>
              <option value="timing">Timing</option>
              <option value="chose someone else">Chose someone else</option>
              <option value="not a fit">Not a fit</option>
              <option value="business closed">Business closed</option>
            </select>
            <span v-if="pipeline.fieldErrors.lost_reason" class="field-error">{{ pipeline.fieldErrors.lost_reason }}</span>
          </label>
          <label>
            Value in cents
            <input v-model.number="draft.value_cents" type="number" min="0" step="1" />
          </label>
          <label>
            Currency
            <input v-model="draft.currency" maxlength="3" />
          </label>
          <label>
            Confidence %
            <input v-model.number="draft.confidence" type="number" min="0" max="100" step="1" />
          </label>
          <label>
            Expected close
            <input v-model="draft.expected_close" type="date" />
          </label>
        </div>
        <div class="action-row">
          <button type="submit" :disabled="pipeline.saving">{{ pipeline.saving ? 'Saving' : 'Save' }}</button>
          <button type="button" class="text-button" @click="archive">Archive</button>
        </div>
      </form>

      <template #aside>
        <section class="panel form-section">
          <h2>Context</h2>
          <dl class="metadata-list single">
            <div>
              <dt>Organization</dt>
              <dd>{{ pipeline.selected.organization?.name ?? 'Unknown' }}</dd>
            </div>
            <div>
              <dt>Stage age</dt>
              <dd>{{ daysInStage(pipeline.selected.stage_changed_at) }} days</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{{ pipeline.selected.confidence ?? 0 }}%</dd>
            </div>
          </dl>
          <div class="action-row">
            <RouterLink class="button-link" :to="`/freelance/opportunities/${pipeline.selected.id}/contact`">
              Contact
            </RouterLink>
            <RouterLink
              v-if="pipeline.selected.organization_id"
              class="text-button"
              :to="`/freelance/organizations/${pipeline.selected.organization_id}`"
            >
              Open organization
            </RouterLink>
          </div>
        </section>
      </template>
    </EntityDetailShell>
    <ActivityTimeline
      v-if="pipeline.selected"
      subject-type="opportunity"
      :subject-id="pipeline.selected.id"
    />
  </section>
</template>
