import type { RawJob } from './sources/types.js';

export const VUE_RE = /\b(vue(\.js|js)?|nuxt(\.js|js)?)\b/i;

const FRONTEND_TITLE_RE = /(front.?end|full.?stack|web|software|javascript|typescript)/i;
const REMOTE_RE = /remote/i;
const EUROPE_RE = /(europe|emea|eu\b|cet|european|worldwide|anywhere|germany|deutschland)/i;
const NON_EU_REMOTE_RE = /(united states|usa|us only|canada|latam|americas|apac|asia|australia|india|africa)/i;
const EXCLUDED_TYPE_RE =
  /(part.?time|teilzeit|internship|intern\b|praktikum|working student|werkstudent|freelance|contract\b|contractor|mini.?job)/i;
const FULL_TIME_RE = /full.?time|vollzeit/i;
const JUNIOR_RE = /(junior|entry.?level|graduate|trainee)/i;
const SENIOR_RE = /(senior|staff|principal|lead)/i;
const MID_RE = /(mid|intermediate)/i;
const GERMAN_REQUIRED_RE =
  /(german|deutsch)\w*[^.!?\n]{0,60}(required|must|mandatory|essential|fluent|native|c1|c2|verhandlungssicher|fließend)/i;
const GERMAN_REQUIRED_REVERSE_RE =
  /(fluent|native|c1|c2|verhandlungssicher|fließend)[^.!?\n]{0,60}(german|deutsch)/i;
const GERMAN_PLUS_RE = /(plus|nice.to.have|bonus|advantage|beneficial|not required|optional|a plus)/i;
const LONG_EXPERIENCE_RE = /\b([7-9]|1[0-9])\+?\s*years?/i;

export type Workplace = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type Seniority = 'mid' | 'senior' | 'mixed' | 'unknown';

export type ScoreResult = {
  score: number;
  reasons: string[];
};

export type FilterDecision = {
  keep: boolean;
  reason?: string;
};

export type LocationDecision = FilterDecision & {
  workplace: Workplace;
  scoreAdjustment: number;
  badge?: 'Berlin' | 'Remote EU' | 'region unverified' | 'location unknown';
};

export function isVueRelevant(raw: Pick<RawJob, 'title' | 'tags' | 'descriptionText'>): FilterDecision {
  const tags = raw.tags?.join(' ') ?? '';
  const titleOrTags = `${raw.title} ${tags}`;
  if (VUE_RE.test(titleOrTags)) return { keep: true };

  const description = raw.descriptionText ?? '';
  if (VUE_RE.test(description) && FRONTEND_TITLE_RE.test(raw.title)) {
    return { keep: true, reason: 'weak-description-match' };
  }

  return { keep: false, reason: 'not-vue-relevant' };
}

export function evaluateLocation(
  raw: Pick<RawJob, 'location' | 'descriptionText' | 'remote' | 'tags'>,
): LocationDecision {
  const location = raw.location ?? '';
  const description = raw.descriptionText ?? '';
  const tags = raw.tags?.join(' ') ?? '';
  const searchable = `${location} ${description} ${tags}`;

  if (/berlin/i.test(location)) {
    return {
      keep: true,
      workplace: raw.remote || REMOTE_RE.test(searchable) ? 'remote' : 'onsite',
      scoreAdjustment: 0,
      badge: 'Berlin',
    };
  }

  const remote = raw.remote === true || REMOTE_RE.test(`${location} ${tags}`);
  if (remote) {
    if (EUROPE_RE.test(searchable)) {
      return { keep: true, workplace: 'remote', scoreAdjustment: 0, badge: 'Remote EU' };
    }

    if (NON_EU_REMOTE_RE.test(searchable) && !EUROPE_RE.test(searchable)) {
      return { keep: false, workplace: 'remote', scoreAdjustment: 0, reason: 'remote-non-eu' };
    }

    return { keep: true, workplace: 'remote', scoreAdjustment: -1, badge: 'region unverified' };
  }

  if (location.trim().length > 0) {
    return { keep: false, workplace: 'onsite', scoreAdjustment: 0, reason: 'not-berlin-or-remote' };
  }

  return { keep: true, workplace: 'unknown', scoreAdjustment: -1, badge: 'location unknown' };
}

export function evaluateEmploymentType(raw: Pick<RawJob, 'title' | 'tags' | 'jobTypes'>): FilterDecision {
  const searchable = [raw.title, ...(raw.tags ?? []), ...(raw.jobTypes ?? [])].join(' ');
  if (EXCLUDED_TYPE_RE.test(searchable) && !FULL_TIME_RE.test(searchable)) {
    return { keep: false, reason: 'excluded-employment-type' };
  }

  return { keep: true };
}

export function evaluateSeniority(title: string): FilterDecision & { seniority: Seniority } {
  if (JUNIOR_RE.test(title)) {
    return { keep: false, seniority: 'unknown', reason: 'junior' };
  }

  const senior = SENIOR_RE.test(title);
  const mid = MID_RE.test(title);

  if (senior && mid) return { keep: true, seniority: 'mixed' };
  if (senior) return { keep: true, seniority: 'senior' };
  if (mid) return { keep: true, seniority: 'mid' };

  return { keep: true, seniority: 'unknown' };
}

export function isGermanRequired(descriptionText: string): boolean {
  const sample = ` ${descriptionText.slice(0, 2000).toLowerCase()} `;
  const germanStopwords = [' der ', ' die ', ' das ', ' und ', ' für ', ' mit ', ' wir ', ' du '];
  const englishStopwords = [' the ', ' and ', ' for ', ' with ', ' you ', ' we '];
  const germanCount = germanStopwords.reduce((sum, word) => sum + countOccurrences(sample, word), 0);
  const englishCount = englishStopwords.reduce((sum, word) => sum + countOccurrences(sample, word), 0);

  if (germanCount > englishCount) return true;

  const sentences = descriptionText.split(/(?<=[.!?\n])/);
  return sentences.some((sentence) => {
    const mentionsRequirement = GERMAN_REQUIRED_RE.test(sentence) || GERMAN_REQUIRED_REVERSE_RE.test(sentence);
    return mentionsRequirement && !GERMAN_PLUS_RE.test(sentence);
  });
}

export function scoreJob(input: {
  title: string;
  tags?: string[];
  location?: string;
  descriptionText?: string;
  seniority: Seniority;
  salaryText?: string;
  locationScoreAdjustment?: number;
}): number {
  return scoreJobDetails(input).score;
}

export function scoreJobDetails(input: {
  title: string;
  tags?: string[];
  location?: string;
  descriptionText?: string;
  seniority: Seniority;
  salaryText?: string;
  locationScoreAdjustment?: number;
}): ScoreResult {
  const tags = input.tags ?? [];
  const tagText = tags.join(' ');
  const description = input.descriptionText ?? '';
  const location = input.location ?? '';
  const reasons: string[] = [];
  let score = 0;

  if (VUE_RE.test(input.title)) {
    score += 3;
    reasons.push('Vue or Nuxt in title');
  }
  if (VUE_RE.test(tagText)) {
    score += 2;
    reasons.push('Vue or Nuxt tag');
  }
  if (/berlin/i.test(location)) {
    score += 2;
    reasons.push('Berlin location');
  }
  if (REMOTE_RE.test(`${location} ${tagText}`) && EUROPE_RE.test(`${location} ${description} ${tagText}`)) {
    score += 2;
    reasons.push('Remote Europe');
  }
  if (/typescript/i.test(`${input.title} ${tagText} ${description}`)) {
    score += 1;
    reasons.push('TypeScript');
  }
  if (/\bnuxt(\.js|js)?\b/i.test(`${input.title} ${tagText} ${description}`)) {
    score += 1;
    reasons.push('Nuxt');
  }
  if (input.seniority === 'mid' || input.seniority === 'mixed') {
    score += 1;
    reasons.push('Mid-level scope');
  }
  if (input.salaryText) {
    score += 1;
    reasons.push('Salary listed');
  }
  if ((input.locationScoreAdjustment ?? 0) < 0) reasons.push('Location needs verification');
  score += input.locationScoreAdjustment ?? 0;
  if (LONG_EXPERIENCE_RE.test(description)) {
    score -= 2;
    reasons.push('7+ years requested');
  }

  return { score: Math.max(-3, Math.min(12, score)), reasons };
}

function countOccurrences(value: string, search: string): number {
  let count = 0;
  let index = value.indexOf(search);

  while (index !== -1) {
    count += 1;
    index = value.indexOf(search, index + search.length);
  }

  return count;
}
