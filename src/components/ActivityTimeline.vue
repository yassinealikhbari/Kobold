<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { apiFetch } from '@/lib/api';
import { absoluteDate } from '@/lib/dates';
import type { Activity, ActivityKind, SubjectType, Task } from '@/types/crm';

const props = defineProps<{
  subjectType: SubjectType;
  subjectId: string;
}>();

const activities = ref<Activity[]>([]);
const tasks = ref<Task[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const kind = ref<ActivityKind>('note');
const body = ref('');
const taskTitle = ref('');
const dueAt = ref('');

const deletableIds = computed(
  () =>
    new Set(
      activities.value
        .filter((item) => Date.now() - new Date(item.created_at).getTime() < 10 * 60_000)
        .map((item) => item.id),
    ),
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const query = `subject_type=${props.subjectType}&subject_id=${props.subjectId}`;
    const [activityResponse, taskResponse] = await Promise.all([
      apiFetch<{ activities: Activity[] }>(`/activities?${query}`),
      apiFetch<{ tasks: Task[] }>(`/tasks?scope=all&${query}`),
    ]);
    activities.value = activityResponse.activities;
    tasks.value = taskResponse.tasks;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load history';
  } finally {
    loading.value = false;
  }
}

async function addActivity() {
  saving.value = true;
  error.value = '';
  try {
    const response = await apiFetch<{ activity: Activity }>('/activities', {
      method: 'POST',
      body: {
        subject_type: props.subjectType,
        subject_id: props.subjectId,
        kind: kind.value,
        body: body.value,
      },
    });
    activities.value.unshift(response.activity);
    body.value = '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to add activity';
  } finally {
    saving.value = false;
  }
}

async function deleteActivity(id: string) {
  try {
    await apiFetch(`/activities/${id}`, { method: 'DELETE' });
    activities.value = activities.value.filter((item) => item.id !== id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to delete activity';
  }
}

async function addTask() {
  saving.value = true;
  error.value = '';
  try {
    const response = await apiFetch<{ task: Task }>('/tasks', {
      method: 'POST',
      body: {
        subject_type: props.subjectType,
        subject_id: props.subjectId,
        title: taskTitle.value,
        due_at: dueAt.value ? new Date(dueAt.value).toISOString() : null,
      },
    });
    tasks.value.push(response.task);
    tasks.value.sort(compareTasks);
    taskTitle.value = '';
    dueAt.value = '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to add task';
  } finally {
    saving.value = false;
  }
}

async function completeTask(task: Task) {
  try {
    await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', body: { done: true } });
    tasks.value = tasks.value.filter((item) => item.id !== task.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to complete task';
  }
}

function setDue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  dueAt.value = localDateTimeValue(date);
}

function localDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function compareTasks(left: Task, right: Task): number {
  if (!left.due_at) return 1;
  if (!right.due_at) return -1;
  return left.due_at.localeCompare(right.due_at);
}

onMounted(load);
</script>

<template>
  <section class="activity-workspace" :aria-busy="loading || saving">
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <section class="panel timeline-panel" aria-labelledby="activity-heading">
      <div class="section-heading">
        <h2 id="activity-heading">Activity</h2>
        <span class="tag-chip">Append only</span>
      </div>
      <form class="activity-form" @submit.prevent="addActivity">
        <label>
          Type
          <select v-model="kind">
            <option value="note">Note</option>
            <option value="visit">Visit</option>
            <option value="dm">DM</option>
            <option value="email">Email</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="proposal">Proposal</option>
          </select>
        </label>
        <label>
          What happened?
          <textarea v-model="body" :required="kind === 'note'" maxlength="10000"></textarea>
        </label>
        <button type="submit" :disabled="saving">Log activity</button>
      </form>

      <p v-if="loading" class="subtle" role="status">Loading history...</p>
      <ol v-else-if="activities.length" class="timeline-list">
        <li v-for="activity in activities" :key="activity.id">
          <div class="timeline-marker" aria-hidden="true"></div>
          <div>
            <div class="timeline-heading">
              <strong>{{ activity.kind.replace('_', ' ') }}</strong>
              <time :datetime="activity.occurred_at">{{ absoluteDate(activity.occurred_at) }}</time>
            </div>
            <p>{{ activity.body || 'No additional detail.' }}</p>
            <button
              v-if="deletableIds.has(activity.id)"
              type="button"
              class="text-button"
              :aria-label="`Delete ${activity.kind.replace('_', ' ')} activity from ${absoluteDate(activity.occurred_at)}`"
              @click="deleteActivity(activity.id)"
            >
              Delete
            </button>
          </div>
        </li>
      </ol>
      <p v-else class="subtle">No activity yet.</p>
    </section>

    <section class="panel followup-panel" aria-labelledby="next-actions-heading">
      <h2 id="next-actions-heading">Next actions</h2>
      <form class="task-form" @submit.prevent="addTask">
        <label>
          Task
          <input v-model="taskTitle" required maxlength="240" placeholder="Follow up about the proposal" />
        </label>
        <label>
          Due
          <input v-model="dueAt" type="datetime-local" />
        </label>
        <div class="quick-dates" aria-label="Quick due dates">
          <button type="button" class="text-button" @click="setDue(1)">Tomorrow</button>
          <button type="button" class="text-button" @click="setDue(3)">In 3 days</button>
          <button type="button" class="text-button" @click="setDue(7)">Next week</button>
        </div>
        <button type="submit" :disabled="saving">Add task</button>
      </form>

      <ul v-if="tasks.length" class="task-list">
        <li v-for="task in tasks" :key="task.id">
          <button type="button" class="task-check" :aria-label="`Complete ${task.title}`" @click="completeTask(task)">
            ✓
          </button>
          <div>
            <strong>{{ task.title }}</strong>
            <time v-if="task.due_at" :datetime="task.due_at">{{ absoluteDate(task.due_at) }}</time>
            <span v-else>No due date</span>
          </div>
          <RouterLink v-if="task.subject_path" class="sr-only" :to="task.subject_path">Open subject</RouterLink>
        </li>
      </ul>
      <p v-else class="subtle">No open tasks.</p>
    </section>
  </section>
</template>
