import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('fill-only safety boundary', () => {
  it('does not submit forms or synthesize clicks', async () => {
    const source = await readFile(new URL('../src/content.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/requestSubmit\s*\(/);
    expect(source).not.toMatch(/\.submit\s*\(/);
    expect(source).not.toMatch(/\.click\s*\(/);
  });
});
