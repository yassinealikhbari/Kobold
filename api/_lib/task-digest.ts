export type DigestTask = {
  title: string;
  subject_label: string | null;
  mode: 'freelance' | 'jobs' | null;
  due_at: string | null;
};

export function buildTaskDigest(tasks: DigestTask[], now = new Date()): string {
  const overdue = tasks.filter((task) => task.due_at && new Date(task.due_at) < now);
  const dueToday = tasks.filter((task) => task.due_at && new Date(task.due_at) >= now);
  const header = `KOBOLD - ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} need attention`;
  const sections = [
    formatSection('OVERDUE', overdue),
    formatSection('DUE TODAY', dueToday),
  ].filter(Boolean);
  return [header, ...sections].join('\n\n').slice(0, 3_900);
}

export function berlinDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatSection(title: string, tasks: DigestTask[]): string {
  if (!tasks.length) return '';
  return [
    title,
    ...tasks.map(
      (task, index) =>
        `${index + 1}. ${compact(task.title, 120)}\n${task.mode === 'jobs' ? 'Job Hunt' : 'Freelance'} - ${compact(task.subject_label ?? 'General', 80)}`,
    ),
  ].join('\n');
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
}

