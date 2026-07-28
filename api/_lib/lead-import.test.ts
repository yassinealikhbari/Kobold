import { describe, expect, it } from 'vitest';

import {
  buildDedupeIndex,
  buildNotesBlock,
  buildOrganizationCreatePayload,
  buildOrganizationUpdatePayload,
  type ContactLite,
  extractPostcode,
  mergeNotes,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  type OpportunityLite,
  type OrganizationLite,
  parseLeadRow,
  parseScore,
  planContactForRow,
  planOpportunityForRow,
  resolveOrganizationMatch,
  shortenDistrict,
} from './lead-import';

function organization(overrides: Partial<OrganizationLite> = {}): OrganizationLite {
  return {
    id: 'org-1',
    name: 'Praxis Example',
    website: null,
    industry: null,
    district: null,
    postcode: null,
    notes: null,
    address: null,
    lead_score: null,
    lead_score_reason: null,
    missing_function: null,
    staleness_evidence: null,
    hook_verified: null,
    source_place_id: null,
    archived_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function contact(overrides: Partial<ContactLite> = {}): ContactLite {
  return {
    id: 'contact-1',
    organization_id: 'org-1',
    full_name: 'Dr. Example',
    phone: null,
    email: null,
    is_primary: false,
    archived_at: null,
    ...overrides,
  };
}

describe('shortenDistrict', () => {
  it('keeps only the text before the first comma', () => {
    expect(shortenDistrict('Mitte, Berlin, Germany')).toBe('Mitte');
  });

  it('passes through a value with no comma', () => {
    expect(shortenDistrict('Kreuzberg')).toBe('Kreuzberg');
  });

  it('returns null for blank input', () => {
    expect(shortenDistrict('')).toBeNull();
    expect(shortenDistrict(undefined)).toBeNull();
  });
});

describe('extractPostcode', () => {
  it('finds a 5-digit postcode inside an address', () => {
    expect(extractPostcode('Föhrer Str. 7, 13353 Berlin, Germany')).toBe('13353');
  });

  it('returns null when no postcode is present', () => {
    expect(extractPostcode('No numbers here')).toBeNull();
    expect(extractPostcode(null)).toBeNull();
  });
});

describe('normalizeDomain', () => {
  it('normalizes scheme, www, path, and case the same way', () => {
    expect(normalizeDomain('https://www.Example.com/')).toBe('example.com');
    expect(normalizeDomain('example.com/path?x=1')).toBe('example.com');
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('returns null for blank or unparseable input', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('strips formatting but keeps a leading plus', () => {
    expect(normalizePhone('+49 30 4539051')).toBe('+49304539051');
  });

  it('strips formatting from a number with no plus', () => {
    expect(normalizePhone('(030) 453-9051')).toBe('0304539051');
  });

  it('returns null for blank input', () => {
    expect(normalizePhone('')).toBeNull();
  });
});

describe('normalizeEmail / parseScore', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Owner@Example.DE ')).toBe('owner@example.de');
    expect(normalizeEmail('')).toBeNull();
  });

  it('parses a numeric score, ignoring unparseable input', () => {
    expect(parseScore('9.5')).toBe(9.5);
    expect(parseScore('')).toBeNull();
    expect(parseScore('n/a')).toBeNull();
  });
});

describe('buildNotesBlock / mergeNotes', () => {
  it('builds a delimited block only from present secondary fields', () => {
    const block = buildNotesBlock({ business: 'x', platform: 'Wix', loads: '3' });
    expect(block).toContain('Platform: Wix');
    expect(block).toContain('Loads: 3');
    expect(block).toMatch(/^--- Clay import data/);
    expect(block).toMatch(/--- end Clay import data ---$/);
  });

  it('returns an empty string when there is nothing to record', () => {
    expect(buildNotesBlock({ business: 'x' })).toBe('');
  });

  it('creates fresh notes when there are none yet', () => {
    expect(mergeNotes(null, 'block')).toBe('block');
    expect(mergeNotes(null, '')).toBeNull();
  });

  it('preserves hand-written notes and replaces only the marked block on re-import', () => {
    const original = 'Met the owner at the market.\n\n--- Clay import data (auto-generated — do not edit below this line) ---\nPlatform: Wix\n--- end Clay import data ---';
    const merged = mergeNotes(original, '--- Clay import data (auto-generated — do not edit below this line) ---\nPlatform: WordPress\n--- end Clay import data ---');
    expect(merged).toContain('Met the owner at the market.');
    expect(merged).toContain('Platform: WordPress');
    expect(merged).not.toContain('Platform: Wix');
    // re-running the merge again must not duplicate the hand-written text
    const mergedTwice = mergeNotes(merged, buildNotesBlock({ business: 'x' }));
    expect(mergedTwice?.match(/Met the owner at the market\./g)?.length).toBe(1);
  });
});

describe('parseLeadRow', () => {
  it('rejects a row with no business name', () => {
    const result = parseLeadRow({ business: '  ' });
    expect(result).toEqual({ error: 'A business name is required' });
  });

  it('normalizes a fully-populated row', () => {
    const result = parseLeadRow({
      business: 'Praxis Example',
      district: 'Mitte, Berlin, Germany',
      address: 'Föhrer Str. 7, 13353 Berlin, Germany',
      category: 'Doctor',
      domain: 'praxis-example.de',
      phone: '+49 30 4539051',
      owner_name: 'Dr. Example',
      email: 'info@praxis-example.de',
      score: '10.0',
      score_reason: 'already pays monthly for a website builder',
      missing_function: 'No online appointment booking',
      staleness_evidence: 'Fax: +49 (0) 30 4539052',
      hook_verified: 'not re-verified',
      place_id: 'ChIJX3o-m3lRqEcR1WfL7E8fxF8',
    });
    if ('error' in result) throw new Error('expected a normalized row');
    expect(result.row.business).toBe('Praxis Example');
    expect(result.row.district).toBe('Mitte');
    expect(result.row.postcode).toBe('13353');
    expect(result.row.website).toBe('https://praxis-example.de');
    expect(result.row.domain).toBe('praxis-example.de');
    expect(result.row.ownerName).toBe('Dr. Example');
    expect(result.row.email).toBe('info@praxis-example.de');
    expect(result.row.score).toBe(10);
    expect(result.row.placeId).toBe('ChIJX3o-m3lRqEcR1WfL7E8fxF8');
  });

  it('falls back gracefully when only phone is present', () => {
    const result = parseLeadRow({ business: 'Dr. Shalah Faraj', phone: '+49 30 2011537' });
    if ('error' in result) throw new Error('expected a normalized row');
    expect(result.row.ownerName).toBeNull();
    expect(result.row.website).toBeNull();
    expect(result.row.email).toBeNull();
  });
});

describe('resolveOrganizationMatch', () => {
  it('matches by place_id first', () => {
    const org = organization({ id: 'org-place', source_place_id: 'place-1', website: 'https://other.de' });
    const index = buildDedupeIndex([org], []);
    const result = parseLeadRow({ business: 'X', domain: 'unrelated.de', place_id: 'place-1' });
    if ('error' in result) throw new Error('expected row');
    const match = resolveOrganizationMatch(result.row, index);
    expect(match.matchedBy).toBe('place_id');
    expect(match.organization?.id).toBe('org-place');
  });

  it('falls back to domain match when place_id is absent or unmatched', () => {
    const org = organization({ id: 'org-domain', website: 'https://www.example.de' });
    const index = buildDedupeIndex([org], []);
    const result = parseLeadRow({ business: 'X', domain: 'example.de' });
    if ('error' in result) throw new Error('expected row');
    const match = resolveOrganizationMatch(result.row, index);
    expect(match.matchedBy).toBe('domain');
    expect(match.organization?.id).toBe('org-domain');
  });

  it('warns when a domain matches more than one organization', () => {
    const older = organization({ id: 'org-a', website: 'https://example.de', updated_at: '2026-01-01T00:00:00Z' });
    const newer = organization({ id: 'org-b', website: 'https://example.de', updated_at: '2026-02-01T00:00:00Z' });
    const index = buildDedupeIndex([older, newer], []);
    const result = parseLeadRow({ business: 'X', domain: 'example.de' });
    if ('error' in result) throw new Error('expected row');
    const match = resolveOrganizationMatch(result.row, index);
    expect(match.organization?.id).toBe('org-b');
    expect(match.warning).toBeTruthy();
  });

  it('falls back to a phone match via an existing contact', () => {
    const org = organization({ id: 'org-phone' });
    const existingContact = contact({ organization_id: 'org-phone', phone: '+49 30 1234567' });
    const index = buildDedupeIndex([org], [existingContact]);
    const result = parseLeadRow({ business: 'X', phone: '+49 30 1234567' });
    if ('error' in result) throw new Error('expected row');
    const match = resolveOrganizationMatch(result.row, index);
    expect(match.matchedBy).toBe('phone');
    expect(match.organization?.id).toBe('org-phone');
  });

  it('reports no match when nothing lines up', () => {
    const index = buildDedupeIndex([], []);
    const result = parseLeadRow({ business: 'X' });
    if ('error' in result) throw new Error('expected row');
    expect(resolveOrganizationMatch(result.row, index).matchedBy).toBe('none');
  });
});

describe('buildOrganizationCreatePayload', () => {
  it('sets origin to other and status to prospect for imported leads', () => {
    const result = parseLeadRow({ business: 'X', category: 'Doctor' });
    if ('error' in result) throw new Error('expected row');
    const payload = buildOrganizationCreatePayload(result.row);
    expect(payload.origin).toBe('other');
    expect(payload.status).toBe('prospect');
    expect(payload.industry).toBe('Doctor');
  });
});

describe('buildOrganizationUpdatePayload', () => {
  it('always overwrites analytical fields but fills user-editable fields only when blank', () => {
    const existing = organization({
      website: 'https://manually-set.de',
      lead_score: 5,
      lead_score_reason: 'old reason',
      industry: null,
    });
    const result = parseLeadRow({
      business: 'X',
      domain: 'clay-domain.de',
      category: 'Doctor',
      score: '9',
      score_reason: 'new reason',
    });
    if ('error' in result) throw new Error('expected row');
    const { payload, changed } = buildOrganizationUpdatePayload(existing, result.row);
    expect(changed).toBe(true);
    expect(payload.lead_score).toBe(9);
    expect(payload.lead_score_reason).toBe('new reason');
    expect(payload.industry).toBe('Doctor');
    expect(payload.website).toBeUndefined();
  });

  it('reports no change when nothing in the row differs from the existing record', () => {
    const existing = organization({ lead_score: 9, lead_score_reason: 'same' });
    const result = parseLeadRow({ business: 'X', score: '9', score_reason: 'same' });
    if ('error' in result) throw new Error('expected row');
    const { changed } = buildOrganizationUpdatePayload(existing, result.row);
    expect(changed).toBe(false);
  });
});

describe('planContactForRow', () => {
  it('does not create a contact with neither phone nor email', () => {
    const result = parseLeadRow({ business: 'X' });
    if ('error' in result) throw new Error('expected row');
    expect(planContactForRow(result.row, 'org-1', [])).toEqual({ action: 'none' });
  });

  it('creates a contact using the business name when owner_name is missing', () => {
    const result = parseLeadRow({ business: 'Dr. Shalah Faraj', phone: '+49 30 2011537' });
    if ('error' in result) throw new Error('expected row');
    const plan = planContactForRow(result.row, 'org-1', []);
    expect(plan.action).toBe('create');
    if (plan.action === 'create') {
      expect(plan.payload.full_name).toBe('Dr. Shalah Faraj');
      expect(plan.payload.role).toBeNull();
    }
  });

  it('marks the first contact for an organization as primary', () => {
    const result = parseLeadRow({ business: 'X', owner_name: 'Owner', phone: '+49 30 1' });
    if ('error' in result) throw new Error('expected row');
    const plan = planContactForRow(result.row, 'org-1', []);
    expect(plan.action).toBe('create');
    if (plan.action === 'create') expect(plan.payload.is_primary).toBe(true);
  });

  it('fills a blank phone/email on an existing contact instead of duplicating it', () => {
    const existing = contact({ full_name: 'Owner', phone: null, email: null });
    const result = parseLeadRow({ business: 'X', owner_name: 'Owner', phone: '+49 30 1' });
    if ('error' in result) throw new Error('expected row');
    const plan = planContactForRow(result.row, 'org-1', [existing]);
    expect(plan).toEqual({ action: 'update', contactId: 'contact-1', payload: { phone: '+49301' } });
  });
});

describe('planOpportunityForRow', () => {
  it('creates a lead opportunity when none is open', () => {
    const result = parseLeadRow({ business: 'X', category: 'Doctor', missing_function: 'No online booking' });
    if ('error' in result) throw new Error('expected row');
    const plan = planOpportunityForRow(result.row, 'org-1', []);
    expect(plan.action).toBe('create');
    if (plan.action === 'create') {
      expect(plan.payload.title).toBe('Website fix: No online booking');
      expect(plan.payload.stage).toBe('lead');
    }
  });

  it('skips when the organization already has an open opportunity', () => {
    const open: OpportunityLite = { id: 'op-1', organization_id: 'org-1', stage: 'contacted', archived_at: null };
    const result = parseLeadRow({ business: 'X' });
    if ('error' in result) throw new Error('expected row');
    expect(planOpportunityForRow(result.row, 'org-1', [open])).toEqual({ action: 'skip' });
  });

  it('does not count won, lost, or archived opportunities as open', () => {
    const closed: OpportunityLite[] = [
      { id: 'op-1', organization_id: 'org-1', stage: 'won', archived_at: null },
      { id: 'op-2', organization_id: 'org-1', stage: 'lead', archived_at: '2026-01-01T00:00:00Z' },
    ];
    const result = parseLeadRow({ business: 'X' });
    if ('error' in result) throw new Error('expected row');
    expect(planOpportunityForRow(result.row, 'org-1', closed).action).toBe('create');
  });

  it('truncates a very long title to 200 characters', () => {
    const result = parseLeadRow({ business: 'X', missing_function: 'x'.repeat(250) });
    if ('error' in result) throw new Error('expected row');
    const plan = planOpportunityForRow(result.row, 'org-1', []);
    if (plan.action === 'create') expect((plan.payload.title as string).length).toBe(200);
  });
});
