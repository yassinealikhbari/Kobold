<script setup lang="ts">
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import EntityDetailShell from '@/components/EntityDetailShell.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Organization"
      title="Organization detail"
      description="Contacts, opportunities, activity, tasks, and site audits will meet here."
    />
    <EntityDetailShell>
      <EmptyState
        title="Organization details are not available yet"
        description="This route is ready for direct links. CRM Phase 1 will connect it to saved organizations."
      >
        <RouterLink class="button-link empty-action" to="/freelance/organizations">
          Back to organizations
        </RouterLink>
      </EmptyState>
    </EntityDetailShell>
  </section>
</template>

