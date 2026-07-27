import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

describe('CSV export', () => {
  it('preserves commas, quotes, newlines, and umlauts', () => {
    const csv = toCsv(
      [{ name: 'Küche, "Mitte"', notes: 'Erste Zeile\nZweite Zeile' }],
      ['name', 'notes'],
    );
    expect(csv).toContain('\uFEFFname,notes\r\n');
    expect(csv).toContain('"Küche, ""Mitte"""');
    expect(csv).toContain('"Erste Zeile\nZweite Zeile"');
  });
});

