import { createHash } from 'node:crypto';

import {
  detectTechnologies,
  evaluateEmploymentType,
  evaluateFreshness,
  evaluateLanguage,
  evaluateLocation,
  evaluateRole,
  evaluateSeniority,
  hasLongExperienceRequirement,
  scoreJobDetails,
  type EmploymentType,
  type RoleFamily,
  type Seniority,
  type Technology,
  type Workplace,
} from './filters.js';
import type { RawJob } from './sources/types.js';

const LEGAL_SUFFIX_RE = /\b(gmbh|se|ag|inc|ltd|co\.?\s?kg)\b/gi;
const GENDER_SUFFIX_RE = /\((m|f|w|d|x|h)[/|,\s]*.*?\)/gi;
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;
const TRACKING_QUERY_RE = /^(?:utm_.+|ref|referrer|source|src|campaign|campaignid|trk|tracking|trackingid)$/i;
const ATS_PATTERNS = [
  { ats: 'greenhouse', re: /https?:\/\/[^\s"'<>]*greenhouse\.io[^\s"'<>]*/i },
  { ats: 'lever', re: /https?:\/\/[^\s"'<>]*lever\.co[^\s"'<>]*/i },
  { ats: 'workable', re: /https?:\/\/[^\s"'<>]*workable\.com[^\s"'<>]*/i },
  { ats: 'personio', re: /https?:\/\/[^\s"'<>]*jobs\.personio\.de[^\s"'<>]*/i },
  { ats: 'ashby', re: /https?:\/\/[^\s"'<>]*ashbyhq\.com[^\s"'<>]*/i },
  { ats: 'join', re: /https?:\/\/[^\s"'<>]*join\.com[^\s"'<>]*/i },
] as const;

export type NormalizedJob = {
  id: string;
  source: string;
  title: string;
  company: string;
  roleFamily: RoleFamily | null;
  location?: string;
  workplace: Workplace;
  url: string;
  applyUrl?: string;
  ats?: string;
  tags: string[];
  technologies: Technology[];
  employmentTypes: EmploymentType[];
  descriptionHtml?: string;
  descriptionText?: string;
  seniority: Seniority;
  germanRequired: boolean;
  salaryText?: string;
  score: number;
  scoreReasons: string[];
  eligibilityWarnings: string[];
  postedAt?: string;
  dedupeKey: string;
  mergeKeys: string[];
  status: 'active';
};

export type NormalizeResult =
  | { keep: true; job: NormalizedJob }
  | { keep: false; reason: string; job?: NormalizedJob };

export type NormalizeOptions = {
  source?: string;
  now?: Date;
  maxAgeDays?: number;
};

export function normalizeRawJob(raw: RawJob, options: NormalizeOptions = {}): NormalizeResult {
  const source = options.source ?? 'unknown';
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? 14;
  const title = cleanTitle(raw.title);
  const company = raw.company.trim() || '(see listing)';
  const location = raw.location?.trim() || undefined;
  const url = raw.url.trim();

  if (!title || !url) return { keep: false, reason: 'missing-title-or-url' };

  const descriptionHtml = truncate(raw.descriptionHtml, 100_000);
  const descriptionText = truncate(raw.descriptionText ?? stripHtml(raw.descriptionHtml ?? ''), 20_000) ?? '';
  const tags = uniqueStrings(raw.tags ?? []);
  const enrichedRaw = { ...raw, title, location, tags, descriptionText };
  const role = evaluateRole(title, { trustedVueSource: source === 'vuejobs' });
  const seniority = evaluateSeniority(title);
  const locationDecision = evaluateLocation(enrichedRaw);
  const employment = evaluateEmploymentType(enrichedRaw);
  const language = evaluateLanguage(descriptionText);
  const freshness = evaluateFreshness(raw.postedAt, now, maxAgeDays);
  const technologies = detectTechnologies({
    title,
    tags,
    descriptionText,
    trustedVueSource: source === 'vuejobs',
  });
  const extracted = extractApplyTarget(descriptionHtml);
  const applyUrl = raw.applyUrl?.trim() || extracted.applyUrl;
  const ats = detectAts(applyUrl) ?? extracted.ats;
  const score = scoreJobDetails({
    title,
    tags,
    location,
    descriptionText,
    seniority: seniority.seniority,
    salaryText: raw.salaryText,
    locationScoreAdjustment: locationDecision.scoreAdjustment,
  });
  const eligibilityWarnings = uniqueStrings([
    ...(role.warnings ?? []),
    ...(seniority.warnings ?? []),
    ...(locationDecision.warnings ?? []),
    ...(employment.warnings ?? []),
    ...(language.warnings ?? []),
    ...(freshness.warnings ?? []),
    ...(hasLongExperienceRequirement(descriptionText) ? ['asks-7-plus-years'] : []),
    ...(technologies.length === 0 ? ['technology-unclassified'] : []),
  ]);
  const baseJob = {
    id: buildSourceJobId(source, url, applyUrl),
    source,
    title,
    company,
    roleFamily: role.family,
    location,
    workplace: locationDecision.workplace,
    url,
    applyUrl,
    ats,
    tags,
    technologies,
    employmentTypes: employment.employmentTypes,
    descriptionHtml,
    descriptionText,
    seniority: seniority.seniority,
    germanRequired: language.germanRequired,
    salaryText: raw.salaryText,
    score: score.score,
    scoreReasons: score.reasons,
    eligibilityWarnings,
    postedAt: freshness.postedAt,
    dedupeKey: buildDedupeKey(company, title, url),
    mergeKeys: buildMergeKeys({ company, title, location, url, applyUrl }),
    status: 'active',
  } satisfies NormalizedJob;

  const exclusions = [role, seniority, employment, language, locationDecision, freshness];
  const exclusion = exclusions.find((decision) => !decision.keep);
  if (exclusion) return { keep: false, reason: exclusion.reason ?? 'ineligible', job: baseJob };

  return { keep: true, job: baseJob };
}

export function cleanTitle(title: string): string {
  return title.replace(GENDER_SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
}

export function normalizedTitleForDedupe(title: string): string {
  return slug(cleanTitle(title));
}

export function slugCompany(company: string, url?: string): string {
  const cleaned = company.replace(LEGAL_SUFFIX_RE, '').trim();
  if (cleaned && cleaned !== '(see listing)') return slug(cleaned);

  if (!url) return 'unknown';
  try {
    return slug(new URL(url).hostname.replace(/^www\./, ''));
  } catch {
    return 'unknown';
  }
}

export function buildDedupeKey(company: string, title: string, url?: string): string {
  return `${slugCompany(company, url)}::${normalizedTitleForDedupe(title)}`;
}

export function buildSourceJobId(source: string, url: string, applyUrl?: string): string {
  const target = canonicalizeUrl(applyUrl || url) || (applyUrl || url).trim();
  return createHash('sha256').update(`${source}:${target}`).digest('hex').slice(0, 24);
}

export function buildMergeKeys(input: {
  company: string;
  title: string;
  location?: string;
  url: string;
  applyUrl?: string;
}): string[] {
  const keys: string[] = [];
  const canonicalApplyUrl = canonicalizeUrl(input.applyUrl);
  const canonicalListingUrl = canonicalizeUrl(input.url);
  if (canonicalApplyUrl) keys.push(`url:${canonicalApplyUrl}`);
  if (canonicalListingUrl) keys.push(`url:${canonicalListingUrl}`);

  if (input.company.trim() && input.company !== '(see listing)') {
    keys.push(
      `role:${slugCompany(input.company)}::${normalizedTitleForDedupe(input.title)}::${slug(input.location ?? 'location-unknown')}`,
    );
  }

  return uniqueStrings(keys);
}

export function canonicalizeUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(decodeHtml(value.trim()));
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_QUERY_RE.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return undefined;
  }
}

export function stripHtml(html: string): string {
  return decodeHtml(html.replace(SCRIPT_STYLE_RE, ' ').replace(TAG_RE, ' ').replace(/\s+/g, ' ').trim());
}

export function extractApplyTarget(html?: string): { applyUrl?: string; ats?: string } {
  if (!html) return {};

  for (const pattern of ATS_PATTERNS) {
    const match = html.match(pattern.re);
    if (match?.[0]) {
      return {
        applyUrl: decodeHtml(match[0]),
        ats: pattern.ats,
      };
    }
  }

  return {};
}

function detectAts(url?: string): string | undefined {
  if (!url) return undefined;
  return ATS_PATTERNS.find((pattern) => pattern.re.test(url))?.ats;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
