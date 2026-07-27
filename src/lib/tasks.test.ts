import { describe, expect, it } from 'vitest';

import { sortTasksByUrgency, taskUrgency } from './tasks';
import type { Task } from '@/types/crm';

const now = new Date('2026-07-10T10:00:00.000Z');

describe('task urgency', () => {
  it('classifies overdue, today, upcoming, and unscheduled tasks', () => {
    expect(taskUrgency(task('2026-07-10T09:00:00.000Z'), now)).toBe('overdue');
    expect(taskUrgency(task('2026-07-10T18:00:00.000Z'), now)).toBe('today');
    expect(taskUrgency(task('2026-07-11T09:00:00.000Z'), now)).toBe('upcoming');
    expect(taskUrgency(task(null), now)).toBe('unscheduled');
  });

  it('orders by urgency and then due date', () => {
    const tasks = [
      task('2026-07-12T09:00:00.000Z'),
      task('2026-07-10T18:00:00.000Z'),
      task('2026-07-10T08:00:00.000Z'),
    ];
    expect(sortTasksByUrgency(tasks, now).map((item) => item.due_at)).toEqual([
      '2026-07-10T08:00:00.000Z',
      '2026-07-10T18:00:00.000Z',
      '2026-07-12T09:00:00.000Z',
    ]);
  });
});

function task(dueAt: string | null): Task {
  return {
    id: dueAt ?? 'none',
    subject_type: null,
    subject_id: null,
    subject_label: null,
    subject_path: null,
    mode: null,
    title: dueAt ?? 'No date',
    due_at: dueAt,
    done_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

