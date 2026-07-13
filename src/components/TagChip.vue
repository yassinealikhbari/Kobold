<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    tone?: 'default' | 'muted' | 'warning';
    removable?: boolean;
  }>(),
  {
    tone: 'default',
    removable: false,
  },
);

const emit = defineEmits<{
  remove: [];
}>();
</script>

<template>
  <span class="tag-chip" :class="`tag-chip--${tone}`">
    <span>{{ label }}</span>
    <button v-if="removable" class="tag-chip-remove" type="button" :aria-label="`Remove ${label}`" @click="emit('remove')">
      ×
    </button>
  </span>
</template>
