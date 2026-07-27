export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(serialize(row[column]))).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function serialize(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

