import { HttpError } from './auth.js';

export const ORGANIZATION_STATUSES = [
  'prospect',
  'active',
  'dormant',
  'closed',
  'disqualified',
] as const;
export const CRM_LANGUAGES = ['de', 'it', 'en'] as const;
export const ORGANIZATION_ORIGINS = [
  'manual',
  'walk_by',
  'referral',
  'inbound',
  'event',
  'other',
] as const;
export const OPPORTUNITY_STAGES = [
  'lead',
  'contacted',
  'conversation',
  'proposal',
  'won',
  'lost',
] as const;
export const OPPORTUNITY_LOST_REASONS = [
  'no budget',
  'no response',
  'timing',
  'chose someone else',
  'not a fit',
  'business closed',
] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export type CrmLanguage = (typeof CRM_LANGUAGES)[number];
export type OrganizationOrigin = (typeof ORGANIZATION_ORIGINS)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpportunityLostReason = (typeof OPPORTUNITY_LOST_REASONS)[number];
export type FieldErrors = Record<string, string>;

type OrganizationInput = {
  name: string;
  website: string | null;
  industry: string | null;
  district: string | null;
  postcode: string | null;
  country: string;
  language: CrmLanguage;
  origin: OrganizationOrigin;
  status: OrganizationStatus;
  notes: string | null;
  address: string | null;
  lead_score: number | null;
  lead_score_reason: string | null;
  missing_function: string | null;
  staleness_evidence: string | null;
  hook_verified: string | null;
  source_place_id: string | null;
};

type ContactInput = {
  organization_id: string | null;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  language: CrmLanguage | null;
  is_primary: boolean;
  notes: string | null;
};

type OpportunityInput = {
  organization_id: string;
  title: string;
  stage: OpportunityStage;
  value_cents: number | null;
  currency: string;
  confidence: number | null;
  expected_close: string | null;
  lost_reason: OpportunityLostReason | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
};

export function organizationPayload(
  value: unknown,
  partial = false,
): Partial<OrganizationInput> {
  const body = asRecord(value);
  const errors: FieldErrors = {};
  const payload: Partial<OrganizationInput> = {};

  readRequiredText(body, payload, errors, 'name', 160, partial);
  readOptionalUrl(body, payload, errors, 'website', 2048);
  readOptionalText(body, payload, errors, 'industry', 120);
  readOptionalText(body, payload, errors, 'district', 120);
  readOptionalText(body, payload, errors, 'postcode', 12);
  readOptionalText(body, payload, errors, 'notes', 10000);
  readEnum(body, payload, errors, 'language', CRM_LANGUAGES);
  readEnum(body, payload, errors, 'origin', ORGANIZATION_ORIGINS);
  readEnum(body, payload, errors, 'status', ORGANIZATION_STATUSES);
  readOptionalText(body, payload, errors, 'address', 500);
  readOptionalText(body, payload, errors, 'lead_score_reason', 2000);
  readOptionalText(body, payload, errors, 'missing_function', 500);
  readOptionalText(body, payload, errors, 'staleness_evidence', 2000);
  readOptionalText(body, payload, errors, 'hook_verified', 500);
  readOptionalText(body, payload, errors, 'source_place_id', 120);
  readOptionalNumber(body, payload, errors, 'lead_score', 0);

  if ('postcode' in payload && payload.postcode && !/^[0-9A-Za-z -]{3,12}$/.test(payload.postcode)) {
    errors.postcode = 'Use 3–12 letters, numbers, spaces, or hyphens.';
  }

  if ('country' in body) {
    const country = cleanText(body.country);
    if (!country || !/^[A-Za-z]{2}$/.test(country)) errors.country = 'Use a two-letter country code.';
    else payload.country = country.toUpperCase();
  } else if (!partial) {
    payload.country = 'DE';
  }

  if (!partial) {
    payload.language ??= 'de';
    payload.origin ??= 'manual';
    payload.status ??= 'prospect';
  }

  throwIfInvalid(errors);
  return payload;
}

export function contactPayload(value: unknown, partial = false): Partial<ContactInput> {
  const body = asRecord(value);
  const errors: FieldErrors = {};
  const payload: Partial<ContactInput> = {};

  readRequiredText(body, payload, errors, 'full_name', 160, partial);
  readOptionalText(body, payload, errors, 'role', 120);
  readOptionalText(body, payload, errors, 'phone', 80);
  readOptionalText(body, payload, errors, 'notes', 10000);
  readOptionalUrl(body, payload, errors, 'instagram', 2048);
  readOptionalUrl(body, payload, errors, 'linkedin', 2048);
  readEnum(body, payload, errors, 'language', CRM_LANGUAGES, true);

  if ('organization_id' in body) {
    const id = cleanText(body.organization_id);
    if (id && !isUuid(id)) errors.organization_id = 'Choose a valid organization.';
    else payload.organization_id = id;
  }

  if ('email' in body) {
    const email = cleanText(body.email);
    if (email && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      errors.email = 'Enter a valid email address.';
    } else {
      payload.email = email?.toLowerCase() ?? null;
    }
  }

  if ('is_primary' in body) {
    if (typeof body.is_primary !== 'boolean') errors.is_primary = 'Use true or false.';
    else payload.is_primary = body.is_primary;
  } else if (!partial) {
    payload.is_primary = false;
  }

  throwIfInvalid(errors);
  return payload;
}

export function opportunityPayload(
  value: unknown,
  partial = false,
): Partial<OpportunityInput> {
  const body = asRecord(value);
  const errors: FieldErrors = {};
  const payload: Partial<OpportunityInput> = {};

  readRequiredText(body, payload, errors, 'title', 200, partial);
  readEnum(body, payload, errors, 'stage', OPPORTUNITY_STAGES);
  readEnum(body, payload, errors, 'lost_reason', OPPORTUNITY_LOST_REASONS, true);

  if ('organization_id' in body) {
    const id = cleanText(body.organization_id);
    if (!id || !isUuid(id)) errors.organization_id = 'Choose a valid organization.';
    else payload.organization_id = id;
  } else if (!partial) {
    errors.organization_id = 'Choose an organization.';
  }

  readNullableInteger(body, payload, errors, 'value_cents', 0, 2_147_483_647);
  readNullableInteger(body, payload, errors, 'confidence', 0, 100);
  readOptionalText(body, payload, errors, 'draft_email_subject', 300);
  readOptionalText(body, payload, errors, 'draft_email_body', 20000);

  if ('currency' in body) {
    const currency = cleanText(body.currency)?.toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) errors.currency = 'Use a three-letter currency code.';
    else payload.currency = currency;
  } else if (!partial) {
    payload.currency = 'EUR';
  }

  if ('expected_close' in body) {
    const date = cleanText(body.expected_close);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.expected_close = 'Use a valid date.';
    else payload.expected_close = date;
  }

  if (!partial) payload.stage ??= 'lead';
  throwIfInvalid(errors);
  return payload;
}

export function validateOpportunityState(
  patch: Partial<OpportunityInput>,
  current?: Pick<OpportunityInput, 'stage' | 'lost_reason'>,
): Partial<OpportunityInput> {
  const nextStage = patch.stage ?? current?.stage ?? 'lead';
  const nextReason =
    nextStage === 'lost'
      ? patch.lost_reason === undefined
        ? current?.lost_reason
        : patch.lost_reason
      : null;
  if (nextStage === 'lost' && !nextReason) {
    throw new HttpError(400, 'A loss reason is required.', {
      fields: { lost_reason: 'Choose why this opportunity was lost.' },
    });
  }
  return { ...patch, lost_reason: nextReason ?? null };
}

export function queryEnum<T extends string>(
  value: string | string[] | undefined,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized || !allowed.includes(normalized as T)) {
    throw new HttpError(400, `Invalid ${field}`, { fields: { [field]: `Choose one of: ${allowed.join(', ')}.` } });
  }
  return normalized as T;
}

export function queryBoolean(
  value: string | string[] | undefined,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new HttpError(400, `Invalid ${field}`, { fields: { [field]: 'Use true or false.' } });
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&').slice(0, 160);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' ? value.trim() || null : null;
}

function readRequiredText<T extends object>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  max: number,
  partial: boolean,
) {
  if (!(field in body)) {
    if (!partial) errors[field] = 'This field is required.';
    return;
  }
  const value = cleanText(body[field]);
  if (!value) errors[field] = 'This field is required.';
  else if (value.length > max) errors[field] = `Use ${max} characters or fewer.`;
  else Object.assign(payload, { [field]: value });
}

function readOptionalText<T extends object>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  max: number,
) {
  if (!(field in body)) return;
  const raw = body[field];
  if (raw !== null && raw !== undefined && typeof raw !== 'string') {
    errors[field] = 'Enter text.';
    return;
  }
  const value = cleanText(raw);
  if (value && value.length > max) errors[field] = `Use ${max} characters or fewer.`;
  else Object.assign(payload, { [field]: value });
}

function readOptionalUrl<T extends object>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  max: number,
) {
  if (!(field in body)) return;
  const raw = cleanText(body[field]);
  if (!raw) {
    Object.assign(payload, { [field]: null });
    return;
  }
  if (raw.length > max) {
    errors[field] = `Use ${max} characters or fewer.`;
    return;
  }
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    Object.assign(payload, { [field]: url.toString() });
  } catch {
    errors[field] = 'Enter a complete http:// or https:// URL.';
  }
}

function readEnum<T extends object, V extends string>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  allowed: readonly V[],
  nullable = false,
) {
  if (!(field in body)) return;
  const value = cleanText(body[field]);
  if (!value && nullable) {
    Object.assign(payload, { [field]: null });
  } else if (!value || !allowed.includes(value as V)) {
    errors[field] = `Choose one of: ${allowed.join(', ')}.`;
  } else {
    Object.assign(payload, { [field]: value });
  }
}

function readNullableInteger<T extends object>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  min: number,
  max: number,
) {
  if (!(field in body)) return;
  const raw = body[field];
  if (raw === null || raw === '') {
    Object.assign(payload, { [field]: null });
    return;
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
    errors[field] = `Use a whole number from ${min} to ${max}.`;
  } else {
    Object.assign(payload, { [field]: raw });
  }
}

function readOptionalNumber<T extends object>(
  body: Record<string, unknown>,
  payload: Partial<T>,
  errors: FieldErrors,
  field: keyof T & string,
  min: number,
) {
  if (!(field in body)) return;
  const raw = body[field];
  if (raw === null || raw === '') {
    Object.assign(payload, { [field]: null });
    return;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min) {
    errors[field] = `Use a number no smaller than ${min}.`;
  } else {
    Object.assign(payload, { [field]: raw });
  }
}

function throwIfInvalid(errors: FieldErrors) {
  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  }
}
