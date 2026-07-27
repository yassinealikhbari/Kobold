import { describe, expect, it } from 'vitest';

import { endOfDayUtc, taskScopeBounds } from './task-scopes';

describe('Europe/Berlin task scopes', () => {
  it('uses the CET boundary in winter', () => {
    expect(endOfDayUtc(new Date('2026-01-10T12:00:00Z')).toISOString()).toBe(
      '2026-01-10T22:59:59.999Z',
    );
  });

  it('uses the CEST boundary in summer', () => {
    expect(endOfDayUtc(new Date('2026-07-10T12:00:00Z')).toISOString()).toBe(
      '2026-07-10T21:59:59.999Z',
    );
  });

  it('separates overdue, today, and upcoming', () => {
    const now = new Date('2026-07-10T12:00:00Z');
    expect(taskScopeBounds('overdue', now)).toEqual({ to: now.toISOString() });
    expect(taskScopeBounds('today', now)).toEqual({
      from: now.toISOString(),
      to: '2026-07-10T21:59:59.999Z',
    });
    expect(taskScopeBounds('upcoming', now)).toEqual({
      from: '2026-07-10T22:00:00.000Z',
      to: '2026-07-17T21:59:59.999Z',
    });
  });
});

