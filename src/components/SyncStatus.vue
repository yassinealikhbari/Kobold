<script setup lang="ts">
import { computed } from 'vue';

import { absoluteDate, relativeDate } from '@/lib/dates';
import type { IngestRun } from '@/types/jobs';

const props = defineProps<{
  runs: IngestRun[];
  refreshing: boolean;
  progress: string;
}>();

const failures = computed(() => props.runs.filter((run) => run.error));
const latest = computed(() => props.runs[0] ?? null);
</script>

<template>
  <div class="sync-status">
    <span v-if="refreshing" class="status-dot active"></span>
    <span v-else-if="failures.length" class="status-dot error"></span>
    <span v-else class="status-dot ok"></span>

    <span v-if="refreshing">Refreshing {{ progress }}</span>
    <span v-else-if="latest" :title="absoluteDate(latest.started_at)">
      {{ latest.source }} synced {{ relativeDate(latest.started_at) }}
    </span>
    <span v-else>No sync runs</span>

    <span v-if="failures.length" class="sync-error" :title="failures.map((run) => `${run.source}: ${run.error}`).join('\n')">
      {{ failures.length }} failed
    </span>
  </div>
</template>
