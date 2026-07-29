import type { Opportunity, OpportunityStage } from '@/types/crm';

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'lead',
  'contacted',
  'conversation',
  'proposal',
  'won',
  'lost',
];

export function pipelineTotals(opportunities: Opportunity[]) {
  const open = opportunities.filter((item) => !['won', 'lost'].includes(item.stage));
  return {
    openValueCents: open.reduce((total, item) => total + (item.value_cents ?? 0), 0),
    weightedValueCents: open.reduce(
      (total, item) => total + Math.round((item.value_cents ?? 0) * ((item.confidence ?? 0) / 100)),
      0,
    ),
    counts: OPPORTUNITY_STAGES.reduce(
      (result, stage) => {
        result[stage] = opportunities.filter((item) => item.stage === stage).length;
        return result;
      },
      {} as Record<OpportunityStage, number>,
    ),
  };
}

export function hasNoIdentifiedFix(missingFunction: string | null | undefined): boolean {
  return /^\s*none\b/i.test(missingFunction ?? '');
}

export function sortOpportunitiesByFix(opportunities: Opportunity[]): Opportunity[] {
  return opportunities
    .slice()
    .sort(
      (a, b) =>
        Number(hasNoIdentifiedFix(a.organization?.missing_function)) -
        Number(hasNoIdentifiedFix(b.organization?.missing_function)),
    );
}

export function daysInStage(stageChangedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(stageChangedAt).getTime()) / 86_400_000));
}

export function formatMoney(cents: number | null, currency = 'EUR'): string {
  if (cents === null) return 'Value not set';
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

