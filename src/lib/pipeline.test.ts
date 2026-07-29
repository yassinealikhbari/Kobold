import { describe, expect, it } from 'vitest';

import { daysInStage, hasNoIdentifiedFix, pipelineTotals, sortOpportunitiesByFix } from './pipeline';
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

describe('hasNoIdentifiedFix', () => {
  it('matches "None" as the whole missing-function word, case-insensitively', () => {
    expect(hasNoIdentifiedFix('None')).toBe(true);
    expect(hasNoIdentifiedFix('none - already has online booking via Doctolib')).toBe(true);
    expect(hasNoIdentifiedFix('NONE, site covers everything')).toBe(true);
  });

  it('does not match a real finding that happens to start with "No"', () => {
    expect(hasNoIdentifiedFix('No online appointment booking system')).toBe(false);
    expect(hasNoIdentifiedFix('Nonexistent contact form')).toBe(false);
  });

  it('treats missing data as having an identified fix (not "none")', () => {
    expect(hasNoIdentifiedFix(null)).toBe(false);
    expect(hasNoIdentifiedFix(undefined)).toBe(false);
    expect(hasNoIdentifiedFix('')).toBe(false);
  });
});

describe('sortOpportunitiesByFix', () => {
  it('moves opportunities with no identified fix to the end, preserving relative order otherwise', () => {
    const a = opportunity('lead', 0, 0, 'No online booking', 'a');
    const b = opportunity('lead', 0, 0, 'None - already covered', 'b');
    const c = opportunity('lead', 0, 0, 'No impressum', 'c');
    const d = opportunity('lead', 0, 0, null, 'd');
    const sorted = sortOpportunitiesByFix([b, a, d, c]);
    expect(sorted.map((item) => item.id)).toEqual([a.id, d.id, c.id, b.id]);
  });
});

function opportunity(
  stage: Opportunity['stage'],
  value_cents: number,
  confidence: number,
  missingFunction: string | null = null,
  id: string = stage,
): Opportunity {
  return {
    id,
    organization_id: 'org',
    title: stage,
    stage,
    value_cents,
    currency: 'EUR',
    confidence,
    expected_close: null,
    lost_reason: stage === 'lost' ? 'timing' : null,
    draft_email_subject: null,
    draft_email_body: null,
    archived_at: null,
    stage_changed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    organization: {
      id: 'org',
      name: 'Org',
      status: 'prospect',
      archived_at: null,
      missing_function: missingFunction,
    },
  };
}

