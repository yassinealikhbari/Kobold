<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Shared workspace"
      title="Today"
      description="One ordered view for overdue and upcoming work across freelance and job hunting."
    />
    <EntityListShell>
      <EmptyState
        title="Nothing needs attention"
        description="Tasks and follow-ups will appear here when the shared activity system arrives in CRM Phase 3."
      />
    </EntityListShell>
  </section>
</template>

