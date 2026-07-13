const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function absoluteDate(value: string | null): string {
  if (!value) return 'Unknown date';
  return formatter.format(new Date(value));
}

export function relativeDate(value: string | null): string {
  if (!value) return 'unknown';

  const diffMs = Date.now() - new Date(value).getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);

  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 48) return `${hours} h ago`;
  return `${days} d ago`;
}
