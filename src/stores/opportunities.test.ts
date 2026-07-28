import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Opportunity } from '@/types/crm';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiFetch,
  ApiError: class ApiError extends Error {},
}));

import { useOpportunitiesStore } from './opportunities';

describe('opportunity optimistic stage movement', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiFetch.mockReset();
  });

  it('keeps the server result after a successful move', async () => {
    const store = useOpportunitiesStore();
    store.opportunities = [opportunity()];
    apiFetch.mockResolvedValue({
      opportunity: { ...opportunity(), stage: 'proposal', lost_reason: null },
    });

    expect(await store.moveOpportunity('opportunity-1', 'proposal')).toBe(true);
    expect(store.opportunities[0]?.stage).toBe('proposal');
  });

  it('rolls back after an API failure', async () => {
    const store = useOpportunitiesStore();
    store.opportunities = [opportunity()];
    apiFetch.mockRejectedValue(new Error('Forced failure'));

    expect(await store.moveOpportunity('opportunity-1', 'proposal')).toBe(false);
    expect(store.opportunities[0]?.stage).toBe('lead');
    expect(store.error).toContain('Forced failure');
  });
});

function opportunity(): Opportunity {
  return {
    id: 'opportunity-1',
    organization_id: 'organization-1',
    title: 'Site',
    stage: 'lead',
    value_cents: 100_000,
    currency: 'EUR',
    confidence: 50,
    expected_close: null,
    lost_reason: null,
    draft_email_subject: null,
    draft_email_body: null,
    archived_at: null,
    stage_changed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    organization: null,
  };
}
