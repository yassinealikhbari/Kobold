import { describe, expect, it } from 'vitest';

import { calculateCrmMetrics } from './crm-metrics';

describe('CRM metrics', () => {
  it('derives conversion, stage duration, value, and loss reasons from events', () => {
    const metrics = calculateCrmMetrics(
      [{ created_at: '2026-07-06T10:00:00Z' }, { created_at: '2026-07-07T10:00:00Z' }],
      [
        { id: 'one', stage: 'won', value_cents: 200_000, currency: 'EUR', lost_reason: null },
        { id: 'two', stage: 'lost', value_cents: 100_000, currency: 'EUR', lost_reason: 'timing' },
      ],
      [
        event('one', '2026-07-01', { metrics_baseline: true, stage: 'lead', value_cents: 200_000, currency: 'EUR' }),
        event('one', '2026-07-02', { to: 'contacted' }),
        event('one', '2026-07-03', { to: 'conversation' }),
        event('one', '2026-07-04', { to: 'proposal' }),
        event('one', '2026-07-05', { to: 'won' }),
        event('two', '2026-07-01', { metrics_baseline: true, stage: 'lead', value_cents: 100_000, currency: 'EUR' }),
        event('two', '2026-07-02', { to: 'contacted' }),
        event('two', '2026-07-04', { to: 'lost', lost_reason: 'timing' }),
      ],
      new Date('2026-07-06T00:00:00Z'),
    );
    expect(metrics.newLeadsPerWeek).toEqual([{ week: '2026-07-06', count: 2 }]);
    expect(metrics.contactToConversationRate).toBe(50);
    expect(metrics.proposalWinRate).toBe(100);
    expect(metrics.lossReasons).toEqual([{ reason: 'timing', count: 1 }]);
    expect(metrics.pipelineValueOverTime.length).toBeGreaterThan(0);
  });
});

function event(subject_id: string, date: string, metadata: Record<string, unknown>) {
  return {
    subject_id,
    kind: 'stage_change',
    metadata,
    occurred_at: `${date}T00:00:00Z`,
  };
}

