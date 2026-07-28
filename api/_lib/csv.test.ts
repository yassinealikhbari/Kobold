import { describe, expect, it } from 'vitest';

import { parseCsv, toCsv } from './csv';

describe('CSV export', () => {
  it('preserves commas, quotes, newlines, and umlauts', () => {
    const csv = toCsv(
      [{ name: 'Küche, "Mitte"', notes: 'Erste Zeile\nZweite Zeile' }],
      ['name', 'notes'],
    );
    expect(csv).toContain('﻿name,notes\r\n');
    expect(csv).toContain('"Küche, ""Mitte"""');
    expect(csv).toContain('"Erste Zeile\nZweite Zeile"');
  });
});

describe('CSV import', () => {
  it('parses simple header and rows', () => {
    const rows = parseCsv('name,phone\nAlex,+49 30 123\nBo,+49 30 456\n');
    expect(rows).toEqual([
      { name: 'Alex', phone: '+49 30 123' },
      { name: 'Bo', phone: '+49 30 456' },
    ]);
  });

  it('handles a quoted field with an embedded comma', () => {
    const rows = parseCsv('business,district\n"à la mode","Mitte, Berlin, Germany"\n');
    expect(rows).toEqual([{ business: 'à la mode', district: 'Mitte, Berlin, Germany' }]);
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const rows = parseCsv('note\n"©2021 ""Olaf"" Meyer"\n');
    expect(rows).toEqual([{ note: '©2021 "Olaf" Meyer' }]);
  });

  it('handles a quoted field with an embedded newline', () => {
    const rows = parseCsv('note\n"Erste Zeile\nZweite Zeile"\n');
    expect(rows).toEqual([{ note: 'Erste Zeile\nZweite Zeile' }]);
  });

  it('handles mixed CRLF and LF line endings in the same file', () => {
    const rows = parseCsv('name,phone\r\nAlex,111\nBo,222\r\n');
    expect(rows).toEqual([
      { name: 'Alex', phone: '111' },
      { name: 'Bo', phone: '222' },
    ]);
  });

  it('strips a leading byte-order mark', () => {
    const rows = parseCsv('﻿name\nAlex\n');
    expect(rows).toEqual([{ name: 'Alex' }]);
  });

  it('ignores trailing blank lines', () => {
    const rows = parseCsv('name\nAlex\n\n\n');
    expect(rows).toEqual([{ name: 'Alex' }]);
  });

  it('pads a row shorter than the header with empty strings', () => {
    const rows = parseCsv('name,phone,email\nAlex\n');
    expect(rows).toEqual([{ name: 'Alex', phone: '', email: '' }]);
  });

  it('returns an empty array for an empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('round-trips through toCsv', () => {
    const original = [{ name: 'Küche, "Mitte"', notes: 'Erste Zeile\nZweite Zeile' }];
    const csv = toCsv(original, ['name', 'notes']);
    expect(parseCsv(csv)).toEqual(original.map((row) => ({ name: row.name, notes: row.notes })));
  });
});
