import { describe, expect, it } from 'vitest';

import { daysInStage, pipelineTotals } from './pipeline';
import type { Opportunity } from '@/types/crm';

describe('opportunity pipeline', () => {
  it('calculates open and weighted values without won or lost deals', () => {
    const opportunities = [
      opportunity('lead', 100_000, 50),
      opportunity('proposal', 200_000, 75),
      opportunity('won', 900_000, 100),
      opportunity('lost', 500_000, 10),
    ];
    expect(pipelineTotals(opportunities)).toMatchObject({
      openValueCents: 300_000,
      weightedValueCents: 200_000,
      counts: { lead: 1, proposal: 1, won: 1, lost: 1 },
    });
  });

  it('calculates whole days in stage', () => {
    expect(daysInStage('2026-01-01T00:00:00.000Z', Date.parse('2026-01-04T12:00:00.000Z'))).toBe(3);
  });
});

function opportunity(
  stage: Opportunity['stage'],
  value_cents: number,
  confidence: number,
): Opportunity {
  return {
    id: stage,
    organization_id: 'org',
    title: stage,
    stage,
    value_cents,
    currency: 'EUR',
    confidence,
    expected_close: null,
    lost_reason: stage === 'lost' ? 'timing' : null,
    archived_at: null,
    stage_changed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    organization: null,
  };
}

