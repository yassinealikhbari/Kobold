<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Contacts"
      description="People connected to prospects and clients, including their preferred outreach language."
    />
    <EntityListShell>
      <EmptyState
        title="No contacts yet"
        description="Contacts will appear here once organization management is added in CRM Phase 1."
      />
    </EntityListShell>
  </section>
</template>

