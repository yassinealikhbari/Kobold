import { describe, expect, it } from 'vitest';

import { isSchemaMigrationError } from './auth.js';

describe('isSchemaMigrationError', () => {
  it('recognizes missing PostgREST schema-cache columns', () => {
    expect(isSchemaMigrationError({ code: 'PGRST204', message: 'Could not find a column' })).toBe(true);
  });

  it('does not classify unrelated errors as migration failures', () => {
    expect(isSchemaMigrationError(new Error('Network request failed'))).toBe(false);
  });
});
