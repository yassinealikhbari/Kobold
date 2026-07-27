export type TaskScope = 'overdue' | 'today' | 'upcoming' | 'all';

export function endOfDayUtc(now: Date, timeZone = 'Europe/Berlin'): Date {
  const parts = dateParts(now, timeZone);
  const nextLocalMidnight = zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day + 1, hour: 0 },
    timeZone,
  );
  return new Date(nextLocalMidnight.getTime() - 1);
}

export function taskScopeBounds(
  scope: TaskScope,
  now = new Date(),
  timeZone = 'Europe/Berlin',
): { from?: string; to?: string } {
  if (scope === 'all') return {};
  if (scope === 'overdue') return { to: now.toISOString() };
  const todayEnd = endOfDayUtc(now, timeZone);
  if (scope === 'today') return { from: now.toISOString(), to: todayEnd.toISOString() };
  return {
    from: new Date(todayEnd.getTime() + 1).toISOString(),
    to: new Date(todayEnd.getTime() + 7 * 86_400_000).toISOString(),
  };
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function zonedTimeToUtc(
  local: { year: number; month: number; day: number; hour: number },
  timeZone: string,
): Date {
  const target = Date.UTC(local.year, local.month - 1, local.day, local.hour);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = dateParts(candidate, timeZone);
    const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour);
    candidate = new Date(candidate.getTime() + target - observedUtc);
  }
  return candidate;
}

