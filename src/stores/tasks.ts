import { defineStore } from 'pinia';

import { apiFetch } from '@/lib/api';
import { sortTasksByUrgency } from '@/lib/tasks';
import type { Task } from '@/types/crm';

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [] as Task[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchDashboard() {
      this.loading = true;
      this.error = null;
      try {
        const scopes = await Promise.all(
          ['overdue', 'today', 'upcoming'].map((scope) =>
            apiFetch<{ tasks: Task[] }>(`/tasks?scope=${scope}`),
          ),
        );
        const unique = new Map(scopes.flatMap((response) => response.tasks).map((task) => [task.id, task]));
        this.tasks = sortTasksByUrgency([...unique.values()]);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load tasks';
      } finally {
        this.loading = false;
      }
    },
    async complete(task: Task) {
      const previous = this.tasks;
      this.tasks = this.tasks.filter((item) => item.id !== task.id);
      try {
        await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: { done: true } });
      } catch (error) {
        this.tasks = previous;
        this.error = error instanceof Error ? error.message : 'Failed to complete task';
      }
    },
  },
});

