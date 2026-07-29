<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { formatMoney } from '@/lib/pipeline';
import { useOpportunitiesStore } from '@/stores/opportunities';

const pipeline = useOpportunitiesStore();

async function restore(id: string) {
  await pipeline.restoreOpportunity(id);
}

onMounted(() => {
  void pipeline.fetchArchivedOpportunities();
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Archive"
      description="Opportunities you archived. Bring one back as a lead when it's worth another look."
    />

    <p v-if="pipeline.error" class="form-error" role="alert">{{ pipeline.error }}</p>
    <div v-if="pipeline.loading" class="panel board-loading" role="status">Loading archive...</div>
    <EmptyState
      v-else-if="pipeline.archived.length === 0"
      title="Nothing archived"
      description="Opportunities you archive from an organization or opportunity page will show up here."
    />

    <div v-else class="crm-card-list">
      <article v-for="opportunity in pipeline.archived" :key="opportunity.id" class="crm-card">
        <div class="crm-card-heading">
          <div>
            <strong>{{ opportunity.title }}</strong>
            <span>{{ opportunity.organization?.name ?? 'Unknown organization' }} · was {{ opportunity.stage }}</span>
          </div>
          <span class="tag-chip">{{ formatMoney(opportunity.value_cents, opportunity.currency) }}</span>
        </div>
        <div class="action-row">
          <button type="button" :disabled="pipeline.saving" @click="restore(opportunity.id)">
            Restore as lead
          </button>
          <RouterLink class="text-button" :to="`/freelance/opportunities/${opportunity.id}`">
            View
          </RouterLink>
          <RouterLink
            v-if="opportunity.organization_id"
            class="text-button"
            :to="`/freelance/organizations/${opportunity.organization_id}`"
          >
            Open organization
          </RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>
