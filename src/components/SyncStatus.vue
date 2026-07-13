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
const latestFailed = computed(() => Boolean(latest.value?.error));
</script>

<template>
  <div class="sync-status">
    <span v-if="refreshing" class="status-dot active"></span>
    <span v-else-if="latestFailed || failures.length" class="status-dot error"></span>
    <span v-else class="status-dot ok"></span>

    <span v-if="refreshing">Refreshing {{ progress }}</span>
    <span v-else-if="latest && latestFailed" :title="absoluteDate(latest.started_at)">
      {{ latest.source }} failed {{ relativeDate(latest.started_at) }}
    </span>
    <span v-else-if="latest" :title="absoluteDate(latest.started_at)">
      {{ latest.source }} synced {{ relativeDate(latest.started_at) }}
    </span>
    <span v-else>No sync runs</span>

    <span v-if="failures.length" class="sync-error" :title="failures.map((run) => `${run.source}: ${run.error}`).join('\n')">
      {{ failures.length }} {{ failures.length === 1 ? 'source' : 'sources' }} failed
    </span>
  </div>
</template>
