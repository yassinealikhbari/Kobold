<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { absoluteDate } from '@/lib/dates';
import {
  APPLICATION_STATUSES,
  useApplicationsStore,
  type TrackedApplication,
} from '@/stores/applications';
import type { ApplicationStatus } from '@/types/applications';

const applications = useApplicationsStore();
const draggedId = ref('');
let notesTimer: number | undefined;
let letterTimer: number | undefined;

const byStatus = computed(() =>
  APPLICATION_STATUSES.reduce(
    (groups, status) => {
      groups[status] = applications.applications.filter((application) => application.status === status);
      return groups;
    },
    {} as Record<ApplicationStatus, TrackedApplication[]>,
  ),
);

function dragStart(application: TrackedApplication) {
  draggedId.value = application.id;
}

function drop(status: ApplicationStatus) {
  const id = draggedId.value;
  draggedId.value = '';
  if (!id) return;
  void applications.updateApplication(id, { status });
}

function daysInColumn(application: TrackedApplication): number {
  const start = application.status_changed_at ?? application.updated_at;
  return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000));
}

watch(
  () => applications.selected?.notes,
  () => {
    window.clearTimeout(notesTimer);
    if (!applications.selected) return;
    const selected = applications.selected;
    notesTimer = window.setTimeout(() => {
      void applications.updateApplication(selected.id, { notes: selected.notes });
    }, 600);
  },
);

watch(
  () => applications.selected?.cover_letter,
  () => {
    window.clearTimeout(letterTimer);
    if (!applications.selected) return;
    const selected = applications.selected;
    letterTimer = window.setTimeout(() => {
      void applications.updateApplication(selected.id, { cover_letter: selected.cover_letter });
    }, 600);
  },
);

onMounted(() => {
  void applications.fetchApplications();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <p class="eyebrow">Applications</p>
      <h1>Tracker</h1>
    </header>

    <p v-if="applications.error" class="form-error">{{ applications.error }}</p>

    <div v-if="applications.loading" class="panel">Loading applications...</div>
    <div v-else class="tracker-layout">
      <section class="kanban-board">
        <div
          v-for="status in APPLICATION_STATUSES"
          :key="status"
          class="kanban-column"
          @dragover.prevent
          @drop="drop(status)"
        >
          <header class="kanban-heading">
            <h2>{{ status }}</h2>
            <span>{{ byStatus[status].length }}</span>
          </header>

          <article
            v-for="application in byStatus[status]"
            :key="application.id"
            class="kanban-card"
            draggable="true"
            @dragstart="dragStart(application)"
            @click="applications.select(application)"
          >
            <strong>{{ application.job_snapshot.title }}</strong>
            <span>{{ application.job_snapshot.company }}</span>
            <small>{{ daysInColumn(application) }} d</small>
            <small v-if="application.notes">Notes</small>
          </article>
        </div>
      </section>

      <aside v-if="applications.selected" class="panel tracker-panel">
        <h2>{{ applications.selected.job_snapshot.title }}</h2>
        <p class="subtle">{{ applications.selected.job_snapshot.company }}</p>
        <dl class="metadata-list single">
          <div>
            <dt>Status</dt>
            <dd>{{ applications.selected.status }}</dd>
          </div>
          <div>
            <dt>Applied</dt>
            <dd>{{ applications.selected.applied_at ? absoluteDate(applications.selected.applied_at) : 'Not marked' }}</dd>
          </div>
        </dl>
        <label>
          Notes
          <textarea v-model="applications.selected.notes" rows="8"></textarea>
        </label>
        <label>
          Cover letter
          <textarea v-model="applications.selected.cover_letter" rows="10"></textarea>
        </label>
        <div class="action-row">
          <a class="button-link" :href="applications.selected.job_snapshot.apply_url ?? applications.selected.job_snapshot.url" target="_blank" rel="noreferrer">Open listing</a>
          <button type="button" @click="applications.deleteApplication(applications.selected.id)">Delete</button>
        </div>
      </aside>
    </div>
  </section>
</template>
