<script setup lang="ts">
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import EntityDetailShell from '@/components/EntityDetailShell.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Opportunity"
      title="Opportunity detail"
      description="Stage, value, activity, follow-ups, and linked documents will live here."
    />
    <EntityDetailShell>
      <EmptyState
        title="Opportunity details are not available yet"
        description="This route is ready for direct links. CRM Phase 2 will connect it to the pipeline."
      >
        <RouterLink class="button-link empty-action" to="/freelance">
          Back to pipeline
        </RouterLink>
      </EmptyState>
    </EntityDetailShell>
  </section>
</template>

