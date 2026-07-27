<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
import { absoluteDate } from '@/lib/dates';
import { taskUrgency, type TaskUrgency } from '@/lib/tasks';
import { useTasksStore } from '@/stores/tasks';

const taskStore = useTasksStore();
const sections: Array<{ urgency: TaskUrgency; label: string }> = [
  { urgency: 'overdue', label: 'Overdue' },
  { urgency: 'today', label: 'Due today' },
  { urgency: 'upcoming', label: 'Next seven days' },
];
const grouped = computed(() =>
  sections.map((section) => ({
    ...section,
    tasks: taskStore.tasks.filter((task) => taskUrgency(task) === section.urgency),
  })),
);

onMounted(() => {
  void taskStore.fetchDashboard();
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Shared workspace"
      title="Today"
      description="One ordered view for overdue and upcoming work across freelance and job hunting."
    />
    <p v-if="taskStore.error" class="form-error">{{ taskStore.error }}</p>
    <EntityListShell>
      <div v-if="taskStore.loading" class="panel board-loading">Loading next actions...</div>
      <EmptyState
        v-else-if="taskStore.tasks.length === 0"
        title="Nothing needs attention"
        description="No overdue or upcoming tasks are due in the next seven days."
      />
      <div v-else class="today-sections">
        <section v-for="section in grouped" :key="section.urgency" class="today-section">
          <header class="kanban-heading">
            <h2>{{ section.label }}</h2>
            <span>{{ section.tasks.length }}</span>
          </header>
          <ul v-if="section.tasks.length" class="today-task-list">
            <li v-for="task in section.tasks" :key="task.id">
              <button type="button" class="task-check" :aria-label="`Complete ${task.title}`" @click="taskStore.complete(task)">
                ✓
              </button>
              <RouterLink :to="task.subject_path ?? '/today'">
                <strong>{{ task.title }}</strong>
                <span>
                  {{ task.mode === 'jobs' ? 'Job Hunt' : task.mode === 'freelance' ? 'Freelance' : 'Shared' }}
                  · {{ task.subject_label ?? 'General task' }}
                </span>
              </RouterLink>
              <time v-if="task.due_at" :datetime="task.due_at">{{ absoluteDate(task.due_at) }}</time>
            </li>
          </ul>
          <p v-else class="subtle">None.</p>
        </section>
      </div>
    </EntityListShell>
  </section>
</template>

