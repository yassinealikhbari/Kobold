import { describe, expect, it } from 'vitest';

import { HttpError } from './auth';
import {
  contactPayload,
  escapeLike,
  organizationPayload,
  opportunityPayload,
  queryBoolean,
  queryEnum,
  validateOpportunityState,
} from './crm-validation';

describe('CRM validation', () => {
  it('normalizes a minimal organization', () => {
    expect(organizationPayload({ name: '  Cavatappi  ', website: 'https://example.com' })).toEqual({
      name: 'Cavatappi',
      website: 'https://example.com/',
      country: 'DE',
      language: 'de',
      origin: 'manual',
      status: 'prospect',
    });
  });

  it.each([
    [{}, 'name'],
    [{ name: 'A', website: 'ftp://example.com' }, 'website'],
    [{ name: 'A', postcode: '!' }, 'postcode'],
    [{ name: 'A', country: 'Germany' }, 'country'],
    [{ name: 'A', language: 'fr' }, 'language'],
    [{ name: 'A', origin: 'scraped' }, 'origin'],
    [{ name: 'A', status: 'new' }, 'status'],
    [{ name: 'A', lead_score: 'high' }, 'lead_score'],
    [{ name: 'A', lead_score: -1 }, 'lead_score'],
    [{ name: 'A', address: 'x'.repeat(501) }, 'address'],
  ])('rejects invalid organization field %s', (input, field) => {
    expectFieldError(() => organizationPayload(input), field);
  });

  it('normalizes the lead-import fields on an organization', () => {
    expect(
      organizationPayload({
        name: 'Praxis Example',
        address: 'Föhrer Str. 7, 13353 Berlin',
        lead_score: 9.5,
        lead_score_reason: 'already pays for a website builder',
        missing_function: 'No online booking',
        staleness_evidence: 'Copyright 2019',
        hook_verified: 'not re-verified',
        source_place_id: 'ChIJX3o-m3lRqEcR1WfL7E8fxF8',
      }),
    ).toMatchObject({
      address: 'Föhrer Str. 7, 13353 Berlin',
      lead_score: 9.5,
      lead_score_reason: 'already pays for a website builder',
      missing_function: 'No online booking',
      staleness_evidence: 'Copyright 2019',
      hook_verified: 'not re-verified',
      source_place_id: 'ChIJX3o-m3lRqEcR1WfL7E8fxF8',
    });
  });

  it('normalizes a contact and permits no organization', () => {
    expect(contactPayload({
      full_name: '  Ada Lovelace ',
      email: ' ADA@EXAMPLE.COM ',
      organization_id: null,
    })).toMatchObject({
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
      organization_id: null,
      is_primary: false,
    });
  });

  it.each([
    [{}, 'full_name'],
    [{ full_name: 'A', email: 'not-email' }, 'email'],
    [{ full_name: 'A', linkedin: 'javascript:alert(1)' }, 'linkedin'],
    [{ full_name: 'A', language: 'fr' }, 'language'],
    [{ full_name: 'A', organization_id: 'wrong' }, 'organization_id'],
  ])('rejects invalid contact field %s', (input, field) => {
    expectFieldError(() => contactPayload(input), field);
  });

  it('validates query enums and booleans', () => {
    expect(queryEnum('active', 'status', ['active', 'closed'])).toBe('active');
    expect(queryBoolean('false', 'archived')).toBe(false);
    expect(() => queryEnum('wrong', 'status', ['active'])).toThrow(HttpError);
    expect(() => queryBoolean('maybe', 'archived')).toThrow(HttpError);
  });

  it('escapes SQL LIKE wildcards', () => {
    expect(escapeLike('100%_match\\')).toBe('100\\%\\_match\\\\');
  });

  it('normalizes opportunity money and confidence', () => {
    expect(opportunityPayload({
      organization_id: '11111111-1111-4111-8111-111111111111',
      title: 'Landing page',
      value_cents: 250000,
      confidence: 60,
    })).toMatchObject({
      title: 'Landing page',
      value_cents: 250000,
      confidence: 60,
      stage: 'lead',
      currency: 'EUR',
    });
  });

  it('requires a reason when entering lost', () => {
    expectFieldError(
      () => validateOpportunityState(opportunityPayload({ stage: 'lost' }, true)),
      'lost_reason',
    );
  });

  it('clears the active loss reason when reopening', () => {
    expect(
      validateOpportunityState(
        { stage: 'conversation' },
        { stage: 'lost', lost_reason: 'timing' },
      ),
    ).toEqual({ stage: 'conversation', lost_reason: null });
  });
});

function expectFieldError(action: () => unknown, field: string) {
  try {
    action();
    throw new Error('Expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).details?.fields).toHaveProperty(field);
  }
}
