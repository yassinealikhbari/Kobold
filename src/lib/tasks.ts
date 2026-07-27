import type { Task } from '@/types/crm';

export type TaskUrgency = 'overdue' | 'today' | 'upcoming' | 'unscheduled';

export function taskUrgency(task: Task, now = new Date()): TaskUrgency {
  if (!task.due_at) return 'unscheduled';
  const due = new Date(task.due_at);
  if (due.getTime() < now.getTime()) return 'overdue';
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  return due <= endToday ? 'today' : 'upcoming';
}

export function sortTasksByUrgency(tasks: Task[], now = new Date()): Task[] {
  const weight: Record<TaskUrgency, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    unscheduled: 3,
  };
  return [...tasks].sort((left, right) => {
    const urgency = weight[taskUrgency(left, now)] - weight[taskUrgency(right, now)];
    if (urgency) return urgency;
    return (left.due_at ?? 'z').localeCompare(right.due_at ?? 'z');
  });
}

