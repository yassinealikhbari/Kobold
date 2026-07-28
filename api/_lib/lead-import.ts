export type LeadRow = Record<string, string>;

export type NormalizedLeadRow = {
  business: string;
  district: string | null;
  address: string | null;
  postcode: string | null;
  category: string | null;
  domain: string | null;
  website: string | null;
  phone: string | null;
  ownerName: string | null;
  email: string | null;
  score: number | null;
  scoreReason: string | null;
  missingFunction: string | null;
  stalenessEvidence: string | null;
  hookVerified: string | null;
  placeId: string | null;
  notesBlock: string;
  draftEmailSubject: string | null;
  draftEmailBody: string | null;
};

export type OrganizationLite = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  district: string | null;
  postcode: string | null;
  notes: string | null;
  address: string | null;
  lead_score: number | null;
  lead_score_reason: string | null;
  missing_function: string | null;
  staleness_evidence: string | null;
  hook_verified: string | null;
  source_place_id: string | null;
  archived_at: string | null;
  updated_at: string;
};

export type ContactLite = {
  id: string;
  organization_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  archived_at: string | null;
};

export type OpportunityLite = {
  id: string;
  organization_id: string;
  stage: string;
  archived_at: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
};

export type DedupeIndex = {
  byPlaceId: Map<string, OrganizationLite>;
  byDomain: Map<string, OrganizationLite[]>;
  contactsByPhone: Map<string, ContactLite>;
  orgsById: Map<string, OrganizationLite>;
};

const NOTES_BLOCK_START = '--- Clay import data (auto-generated — do not edit below this line) ---';
const NOTES_BLOCK_END = '--- end Clay import data ---';
const NOTES_BLOCK_PATTERN = /--- Clay import data[\s\S]*?--- end Clay import data ---\n?/;

const OPEN_STAGES = new Set(['lead', 'contacted', 'conversation', 'proposal']);

const ANALYTICAL_FIELDS = [
  'address',
  'lead_score',
  'lead_score_reason',
  'missing_function',
  'staleness_evidence',
  'hook_verified',
] as const;

const FILL_BLANK_FIELDS = ['website', 'industry', 'district', 'postcode'] as const;

export function parseLeadRow(raw: LeadRow): { row: NormalizedLeadRow } | { error: string } {
  const business = (raw.business ?? '').trim();
  if (!business) return { error: 'A business name is required' };

  const address = nonEmpty(raw.address, 500);

  return {
    row: {
      business,
      district: shortenDistrict(raw.district),
      address,
      postcode: extractPostcode(address),
      category: nonEmpty(raw.category, 120),
      domain: normalizeDomain(raw.domain),
      website: normalizeDomain(raw.domain) ? `https://${normalizeDomain(raw.domain)}` : null,
      phone: normalizePhone(raw.phone),
      ownerName: nonEmpty(raw.owner_name, 160),
      email: normalizeEmail(raw.email),
      score: parseScore(raw.score),
      scoreReason: nonEmpty(raw.score_reason, 2000),
      missingFunction: nonEmpty(raw.missing_function, 500),
      stalenessEvidence: nonEmpty(raw.staleness_evidence, 2000),
      hookVerified: nonEmpty(raw.hook_verified, 500),
      placeId: nonEmpty(raw.place_id, 120),
      notesBlock: buildNotesBlock(raw),
      draftEmailSubject: nonEmpty(raw.email_subject ?? raw.subject, 300),
      draftEmailBody: nonEmpty(raw.email_body ?? raw.draft, 20000),
    },
  };
}

export function shortenDistrict(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const first = trimmed.split(',')[0]?.trim() ?? '';
  return first ? first.slice(0, 120) : null;
}

export function extractPostcode(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

export function normalizeDomain(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

export function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().toLowerCase();
  return trimmed || null;
}

export function parseScore(value: string | undefined): number | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonEmpty(value: string | undefined, max: number): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function buildNotesBlock(raw: LeadRow): string {
  const lines: string[] = [];
  if (raw.platform) lines.push(`Platform: ${raw.platform}`);
  if (raw.subscription_builder) lines.push(`Subscription builder: ${raw.subscription_builder}`);
  if (raw.loads) lines.push(`Loads: ${raw.loads}`);
  if (raw.has_impressum) lines.push(`Has impressum: ${raw.has_impressum}`);
  if (raw.distance_km_from_10967) lines.push(`Distance from 10967: ${raw.distance_km_from_10967} km`);
  if (raw.est_bike_min) lines.push(`Est. bike time: ${raw.est_bike_min} min`);
  if (lines.length === 0) return '';
  return [NOTES_BLOCK_START, ...lines, NOTES_BLOCK_END].join('\n');
}

export function mergeNotes(existingNotes: string | null, freshBlock: string): string | null {
  const withoutOldBlock = (existingNotes ?? '').replace(NOTES_BLOCK_PATTERN, '').trim();
  if (!freshBlock) return withoutOldBlock || null;
  return withoutOldBlock ? `${withoutOldBlock}\n\n${freshBlock}` : freshBlock;
}

export function buildDedupeIndex(
  organizations: OrganizationLite[],
  contacts: ContactLite[],
): DedupeIndex {
  const byPlaceId = new Map<string, OrganizationLite>();
  const byDomain = new Map<string, OrganizationLite[]>();
  const orgsById = new Map<string, OrganizationLite>();

  for (const org of organizations) {
    orgsById.set(org.id, org);
    if (org.source_place_id) byPlaceId.set(org.source_place_id, org);
    const host = normalizeDomain(org.website);
    if (host) {
      const list = byDomain.get(host) ?? [];
      list.push(org);
      byDomain.set(host, list);
    }
  }

  const contactsByPhone = new Map<string, ContactLite>();
  for (const contact of contacts) {
    const phone = normalizePhone(contact.phone);
    if (phone && contact.organization_id && !contactsByPhone.has(phone)) {
      contactsByPhone.set(phone, contact);
    }
  }

  return { byPlaceId, byDomain, contactsByPhone, orgsById };
}

export type OrganizationMatch = {
  organization: OrganizationLite | null;
  matchedBy: 'place_id' | 'domain' | 'phone' | 'none';
  warning?: string;
};

export function resolveOrganizationMatch(row: NormalizedLeadRow, index: DedupeIndex): OrganizationMatch {
  if (row.placeId) {
    const match = index.byPlaceId.get(row.placeId);
    if (match) return { organization: match, matchedBy: 'place_id' };
  }

  if (row.domain) {
    const candidates = index.byDomain.get(row.domain) ?? [];
    if (candidates.length === 1) return { organization: candidates[0]!, matchedBy: 'domain' };
    if (candidates.length > 1) {
      const mostRecent = [...candidates].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
      return {
        organization: mostRecent,
        matchedBy: 'domain',
        warning: 'Multiple existing organizations share this domain; matched the most recently updated one.',
      };
    }
  }

  if (row.phone) {
    const contact = index.contactsByPhone.get(row.phone);
    if (contact?.organization_id) {
      const org = index.orgsById.get(contact.organization_id);
      if (org) return { organization: org, matchedBy: 'phone' };
    }
  }

  return { organization: null, matchedBy: 'none' };
}

export function buildOrganizationCreatePayload(row: NormalizedLeadRow): Record<string, unknown> {
  return {
    name: row.business,
    website: row.website,
    industry: row.category,
    district: row.district,
    postcode: row.postcode,
    origin: 'other',
    status: 'prospect',
    notes: mergeNotes(null, row.notesBlock),
    address: row.address,
    lead_score: row.score,
    lead_score_reason: row.scoreReason,
    missing_function: row.missingFunction,
    staleness_evidence: row.stalenessEvidence,
    hook_verified: row.hookVerified,
    source_place_id: row.placeId,
  };
}

export function buildOrganizationUpdatePayload(
  existing: OrganizationLite,
  row: NormalizedLeadRow,
): { payload: Record<string, unknown>; changed: boolean } {
  const payload: Record<string, unknown> = {};

  const analyticalSource: Record<(typeof ANALYTICAL_FIELDS)[number], unknown> = {
    address: row.address,
    lead_score: row.score,
    lead_score_reason: row.scoreReason,
    missing_function: row.missingFunction,
    staleness_evidence: row.stalenessEvidence,
    hook_verified: row.hookVerified,
  };
  for (const field of ANALYTICAL_FIELDS) {
    const next = analyticalSource[field];
    if (next !== null && next !== existing[field]) payload[field] = next;
  }

  const fillBlankSource: Record<(typeof FILL_BLANK_FIELDS)[number], unknown> = {
    website: row.website,
    industry: row.category,
    district: row.district,
    postcode: row.postcode,
  };
  for (const field of FILL_BLANK_FIELDS) {
    const existingValue = existing[field];
    const next = fillBlankSource[field];
    if (!existingValue && next) payload[field] = next;
  }

  if (row.placeId && !existing.source_place_id) payload.source_place_id = row.placeId;

  const mergedNotes = mergeNotes(existing.notes, row.notesBlock);
  if (mergedNotes !== existing.notes) payload.notes = mergedNotes;

  return { payload, changed: Object.keys(payload).length > 0 };
}

export type ContactPlan =
  | { action: 'none' }
  | { action: 'create'; payload: Record<string, unknown> }
  | { action: 'update'; contactId: string; payload: Record<string, unknown> };

export function planContactForRow(
  row: NormalizedLeadRow,
  organizationId: string,
  existingContacts: ContactLite[],
): ContactPlan {
  if (!row.phone && !row.email) return { action: 'none' };

  const fullName = row.ownerName || row.business;
  const existing =
    (row.phone && existingContacts.find((c) => normalizePhone(c.phone) === row.phone)) ||
    (row.email && existingContacts.find((c) => (c.email ?? '').toLowerCase() === row.email)) ||
    existingContacts.find((c) => c.full_name.toLowerCase() === fullName.toLowerCase()) ||
    null;

  if (existing) {
    const payload: Record<string, unknown> = {};
    if (!existing.phone && row.phone) payload.phone = row.phone;
    if (!existing.email && row.email) payload.email = row.email;
    if (Object.keys(payload).length === 0) return { action: 'none' };
    return { action: 'update', contactId: existing.id, payload };
  }

  return {
    action: 'create',
    payload: {
      organization_id: organizationId,
      full_name: fullName,
      phone: row.phone,
      email: row.email,
      role: row.ownerName ? 'Owner' : null,
      is_primary: existingContacts.length === 0,
    },
  };
}

export type OpportunityPlan =
  | { action: 'create'; payload: Record<string, unknown> }
  | { action: 'update'; opportunityId: string; payload: Record<string, unknown> }
  | { action: 'skip' };

export function planOpportunityForRow(
  row: NormalizedLeadRow,
  organizationId: string,
  existingOpportunities: OpportunityLite[],
): OpportunityPlan {
  const open = existingOpportunities.find((item) => !item.archived_at && OPEN_STAGES.has(item.stage));
  if (open) {
    const payload: Record<string, unknown> = {};
    if (row.draftEmailSubject && row.draftEmailSubject !== open.draft_email_subject) {
      payload.draft_email_subject = row.draftEmailSubject;
    }
    if (row.draftEmailBody && row.draftEmailBody !== open.draft_email_body) {
      payload.draft_email_body = row.draftEmailBody;
    }
    if (Object.keys(payload).length === 0) return { action: 'skip' };
    return { action: 'update', opportunityId: open.id, payload };
  }
  return {
    action: 'create',
    payload: {
      organization_id: organizationId,
      title: buildOpportunityTitle(row),
      stage: 'lead',
      draft_email_subject: row.draftEmailSubject,
      draft_email_body: row.draftEmailBody,
    },
  };
}

function buildOpportunityTitle(row: NormalizedLeadRow): string {
  const title = row.missingFunction
    ? `Website fix: ${row.missingFunction}`
    : `${row.category ?? 'Business'} — new prospect`;
  return title.length > 200 ? `${title.slice(0, 199)}…` : title;
}
