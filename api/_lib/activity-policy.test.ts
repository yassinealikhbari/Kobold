import { describe, expect, it } from 'vitest';

import { activityDeleteThreshold, canDeleteActivity } from './activity-policy';

describe('activity deletion window', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');

  it('includes the exact ten-minute boundary', () => {
    expect(canDeleteActivity('2026-07-10T11:50:00.000Z', now)).toBe(true);
    expect(activityDeleteThreshold(now)).toBe('2026-07-10T11:50:00.000Z');
  });

  it('rejects an activity older than ten minutes', () => {
    expect(canDeleteActivity('2026-07-10T11:49:59.999Z', now)).toBe(false);
  });
});

