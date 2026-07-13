import { describe, expect, it } from 'vitest';

import { combineIngestMessages, determineIngestOutcome } from './ingest-health.js';

describe('ingest outcome', () => {
  it('distinguishes successful, empty, partial, and failed source runs', () => {
    expect(determineIngestOutcome({ found: 4 })).toBe('success');
    expect(determineIngestOutcome({ found: 0 })).toBe('empty');
    expect(determineIngestOutcome({ found: 4, warnings: ['Remote page failed'] })).toBe('partial');
    expect(determineIngestOutcome({ found: 0, adapterError: 'Feed unavailable' })).toBe('failed');
  });

  it('combines only populated diagnostic messages', () => {
    expect(combineIngestMessages([null, 'first', undefined, 'second'])).toBe('first | second');
    expect(combineIngestMessages([null, undefined])).toBeNull();
  });
});
