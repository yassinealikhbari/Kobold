export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.length ? `?${params.join('&')}` : '';
  return `mailto:${encodeURIComponent(to.trim())}${query}`;
}
