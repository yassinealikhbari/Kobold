import {
  evaluateEmploymentType,
  evaluateLocation,
  evaluateSeniority,
  isGermanRequired,
  isVueRelevant,
  scoreJobDetails,
} from './filters.js';
import type { RawJob } from './sources/types.js';

const LEGAL_SUFFIX_RE = /\b(gmbh|se|ag|inc|ltd|co\.?\s?kg)\b/gi;
const GENDER_SUFFIX_RE = /\((m|f|w|d|x|h)[/|,\s]*.*?\)/gi;
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;
const ATS_PATTERNS = [
  { ats: 'greenhouse', re: /https?:\/\/[^\s"'<>]*greenhouse\.io[^\s"'<>]*/i },
  { ats: 'lever', re: /https?:\/\/[^\s"'<>]*lever\.co[^\s"'<>]*/i },
  { ats: 'workable', re: /https?:\/\/[^\s"'<>]*workable\.com[^\s"'<>]*/i },
  { ats: 'personio', re: /https?:\/\/[^\s"'<>]*jobs\.personio\.de[^\s"'<>]*/i },
  { ats: 'ashby', re: /https?:\/\/[^\s"'<>]*ashbyhq\.com[^\s"'<>]*/i },
  { ats: 'join', re: /https?:\/\/[^\s"'<>]*join\.com[^\s"'<>]*/i },
] as const;

export type NormalizedJob = {
  title: string;
  company: string;
  location?: string;
  workplace: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  url: string;
  applyUrl?: string;
  ats?: string;
  tags: string[];
  descriptionHtml?: string;
  descriptionText?: string;
  seniority: 'mid' | 'senior' | 'mixed' | 'unknown';
  germanRequired: boolean;
  salaryText?: string;
  score: number;
  scoreReasons: string[];
  postedAt?: string;
  dedupeKey: string;
  status: 'active' | 'dismissed';
};

export type NormalizeResult =
  | { keep: true; job: NormalizedJob }
  | { keep: false; reason: string; job?: NormalizedJob };

export function normalizeRawJob(raw: RawJob): NormalizeResult {
  const title = cleanTitle(raw.title);
  const company = raw.company.trim() || '(see listing)';
  const url = raw.url.trim();

  if (!title || !url) return { keep: false, reason: 'missing-title-or-url' };

  const descriptionHtml = truncate(raw.descriptionHtml, 100_000);
  const descriptionText = truncate(raw.descriptionText ?? stripHtml(raw.descriptionHtml ?? ''), 20_000) ?? '';
  const tags = raw.tags ?? [];
  const relevance = isVueRelevant({ title, tags, descriptionText });
  const location = evaluateLocation({ ...raw, descriptionText, tags });
  const employmentType = evaluateEmploymentType({ title, tags, jobTypes: raw.jobTypes });
  const seniority = evaluateSeniority(title);
  const germanRequired = isGermanRequired(descriptionText);
  const extracted = extractApplyTarget(descriptionHtml);
  const applyUrl = raw.applyUrl ?? extracted.applyUrl;
  const ats = extracted.ats;
  const score = scoreJobDetails({
    title,
    tags,
    location: raw.location,
    descriptionText,
    seniority: seniority.seniority,
    salaryText: raw.salaryText,
    locationScoreAdjustment: location.scoreAdjustment,
  });
  const baseJob = {
    title,
    company,
    location: raw.location,
    workplace: location.workplace,
    url,
    applyUrl,
    ats,
    tags,
    descriptionHtml,
    descriptionText,
    seniority: seniority.seniority,
    germanRequired,
    salaryText: raw.salaryText,
    postedAt: raw.postedAt,
    dedupeKey: buildDedupeKey(company, title, url),
    score: score.score,
    scoreReasons: score.reasons,
    status: germanRequired ? 'dismissed' : 'active',
  } satisfies NormalizedJob;

  if (!relevance.keep) return { keep: false, reason: relevance.reason ?? 'not-vue-relevant' };
  if (!location.keep) return { keep: false, reason: location.reason ?? 'location-filtered' };
  if (!employmentType.keep) return { keep: false, reason: employmentType.reason ?? 'employment-type-filtered' };
  if (!seniority.keep) return { keep: false, reason: seniority.reason ?? 'seniority-filtered' };
  if (germanRequired) return { keep: false, reason: 'german-required', job: baseJob };

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

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-');
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
