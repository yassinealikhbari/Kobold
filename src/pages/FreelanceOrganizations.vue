<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Organizations"
      description="Businesses, prospects, and future clients in one searchable workspace."
    />
    <EntityListShell>
      <EmptyState
        title="No organizations yet"
        description="Organization capture and contact management arrive in CRM Phase 1."
      />
    </EntityListShell>
  </section>
</template>

