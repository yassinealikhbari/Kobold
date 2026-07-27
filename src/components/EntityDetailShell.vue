<template>
  <div class="entity-detail-shell">
    <section class="entity-detail-main">
      <slot />
    </section>
    <aside v-if="$slots.aside" class="entity-detail-aside">
      <slot name="aside" />
    </aside>
  </div>
</template>

