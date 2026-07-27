<template>
  <div class="entity-list-shell">
    <div v-if="$slots.toolbar" class="entity-toolbar">
      <slot name="toolbar" />
    </div>
    <slot />
  </div>
</template>

