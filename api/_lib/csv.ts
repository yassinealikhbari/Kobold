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

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(stripBom(text)).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return [];
  const header = rows[0]!.map((cell) => cell.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      if (key) record[key] = (row[index] ?? '').trim();
    });
    return record;
  });
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
        } else {
          inQuotes = false;
          index += 1;
        }
      } else {
        field += char;
        index += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
    } else {
      field += char;
      index += 1;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

