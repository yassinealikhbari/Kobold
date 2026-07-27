<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="panel empty-state" aria-live="polite">
    <h2>{{ title }}</h2>
    <p class="subtle">{{ description }}</p>
    <slot />
  </section>
</template>

