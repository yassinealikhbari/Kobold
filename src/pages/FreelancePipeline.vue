<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Pipeline"
      description="Track prospective client work from the first lead through proposal and outcome."
    />
    <EmptyState
      title="No opportunities yet"
      description="The pipeline is ready. Organizations and opportunities arrive in the next CRM phases."
    />
  </section>
</template>

