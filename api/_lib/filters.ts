import type { RawJob } from './sources/types.js';
import { franc } from 'franc-min';

export const VUE_RE = /\b(vue(?:\.js|js)?|nuxt(?:\.js|js)?)\b/i;

const REACT_RE = /\breact(?:\.js|js)?\b/i;
const FRONTEND_RE = /\bfront[\s-]?end\b/i;
const FULL_STACK_RE = /\bfull[\s-]?stack\b/i;
const UI_RE = /\b(?:ui|user interface)\b/i;
const PRODUCT_ENGINEER_RE = /\bproduct\s+(?:software\s+)?(?:engineer|developer)\b/i;
const SOFTWARE_ENGINEER_RE = /\bsoftware\s+(?:engineer|developer)\b/i;
const ENGINEER_OR_DEVELOPER_RE = /\b(?:engineer|developer)\b/i;
const OUT_OF_SCOPE_LEVEL_RE = /\b(?:staff|principal|lead|manager|director|head|architect|vp|vice president|chief)\b/i;
const JUNIOR_RE = /\b(?:junior|entry[\s-]?level|graduate|trainee|apprentice|student|intern(?:ship)?)\b/i;
const SENIOR_RE = /\b(?:senior|sr\.?)\b/i;
const MID_RE = /\b(?:mid(?:dle)?[\s-]?level|mid|intermediate)\b/i;
const MOBILE_RE = /\b(?:mobile|android|ios|react native|flutter)\b/i;
const NON_PRODUCT_ENGINEERING_RE =
  /\b(?:back[\s-]?end|data|machine learning|ml|ai|devops|site reliability|sre|security|qa|quality assurance|test automation|embedded|firmware|infrastructure|platform|support)\b/i;

const FULL_TIME_RE = /\b(?:full[\s-]?time|permanent|vollzeit)\b/i;
const CONTRACT_RE = /\b(?:contract|contractor|fixed[\s-]?term|temporary)\b/i;
const FREELANCE_RE = /\b(?:freelance|freelancer|self[\s-]?employed)\b/i;
const PART_TIME_RE = /\b(?:part[\s-]?time|teilzeit|mini[\s-]?job)\b/i;
const INTERNSHIP_RE = /\b(?:intern(?:ship)?|working student|werkstudent|student job|praktikum|trainee)\b/i;

const REMOTE_RE = /\b(?:remote|work from home|home office)\b/i;
const DESCRIPTION_REMOTE_RE = /\b(?:fully remote|100% remote|remote[\s-]?first|work from anywhere)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const GERMANY_RE =
  /\b(?:germany|deutschland|berlin|hamburg|munich|m[üu]nchen|cologne|k[öo]ln|frankfurt|stuttgart|d[üu]sseldorf|leipzig|dresden|bremen|hannover|hanover|nuremberg|n[üu]rnberg|dortmund|essen|bonn|karlsruhe|mannheim|potsdam|aachen|m[üu]nster|freiburg|heidelberg)\b/i;
const GERMANY_COUNTRY_CODE_RE = /(?:^|[,|/()\s])DEU?(?=$|[,|/()\s])/i;
const EUROPE_RE =
  /\b(?:europe|european union|eu|emea|cet|cest|dach|austria|belgium|bulgaria|croatia|cyprus|czech(?:ia| republic)?|denmark|estonia|finland|france|greece|hungary|ireland|italy|latvia|lithuania|luxembourg|malta|netherlands|poland|portugal|romania|slovakia|slovenia|spain|sweden|switzerland|norway|iceland|liechtenstein|united kingdom|uk)\b/i;
const EUROPE_COUNTRY_CODE_RE =
  /(?:^|[,|/()\s])(?:AT|AUT|BE|BEL|BG|BGR|HR|HRV|CY|CYP|CZ|CZE|DK|DNK|EE|EST|FI|FIN|FR|FRA|GR|GRC|HU|HUN|IE|IRL|IT|ITA|LV|LVA|LT|LTU|LU|LUX|MT|MLT|NL|NLD|PL|POL|PT|PRT|RO|ROU|SK|SVK|SI|SVN|ES|ESP|SE|SWE|CH|CHE|NO|NOR|IS|ISL|LI|LIE|GB|GBR|UK)(?=$|[,|/()\s])/i;
const WORLDWIDE_RE = /\b(?:worldwide|anywhere|global|work from anywhere|all countries|international)\b/i;
const NON_EU_REMOTE_RE =
  /\b(?:united states|u\.s\.|usa|us only|north america|canada|latam|latin america|americas|apac|asia|australia|new zealand|india|africa|middle east)\b/i;
const AMBIGUOUS_LOCATION_RE = /\b(?:multiple locations|various locations|location flexible|tbd|not specified|europe|eu|emea)\b/i;

const GERMAN_REQUIREMENT_RE = [
  /\b(?:german|deutsch)\b[^.!?\n]{0,80}\b(?:required|mandatory|must|essential|fluent|native|business fluent|c1|c2|verhandlungssicher|flie(?:ss|ß)end)\b/i,
  /\b(?:required|mandatory|must|essential|fluent|native|business fluent|c1|c2)\b[^.!?\n]{0,80}\b(?:german|deutsch)\b/i,
];
const OPTIONAL_GERMAN_RE =
  /\b(?:not required|optional|nice to have|a plus|plus|bonus|advantage|preferred|beneficial|helpful)\b/i;
const LONG_EXPERIENCE_RE = /\b(?:[7-9]|1[0-9])\+?\s*(?:years?|yrs?)\b/i;

const GERMAN_WORDS = new Set([
  'aber',
  'als',
  'auch',
  'auf',
  'bei',
  'das',
  'deine',
  'den',
  'der',
  'dich',
  'die',
  'du',
  'eine',
  'einen',
  'für',
  'im',
  'ist',
  'mit',
  'sind',
  'suchen',
  'und',
  'unser',
  'werden',
  'wir',
  'zu',
]);
const ENGLISH_WORDS = new Set([
  'a',
  'about',
  'all',
  'and',
  'are',
  'as',
  'at',
  'be',
  'build',
  'by',
  'can',
  'company',
  'experience',
  'for',
  'from',
  'have',
  'help',
  'in',
  'into',
  'is',
  'it',
  'job',
  'new',
  'of',
  'on',
  'or',
  'our',
  'product',
  'role',
  'team',
  'that',
  'the',
  'this',
  'to',
  'us',
  'we',
  'will',
  'with',
  'work',
  'you',
  'your',
]);

export type Workplace = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type Seniority = 'mid' | 'senior' | 'mixed' | 'unknown';
export type Technology = 'vue' | 'nuxt' | 'react';
export type EmploymentType = 'full-time' | 'contract' | 'freelance' | 'unknown';
export type RoleFamily = 'frontend' | 'ui' | 'product' | 'full-stack' | 'software';

export type ScoreResult = {
  score: number;
  reasons: string[];
};

export type FilterDecision = {
  keep: boolean;
  reason?: string;
  warnings?: string[];
};

export type RoleDecision = FilterDecision & {
  family: RoleFamily | null;
};

export type LocationDecision = FilterDecision & {
  workplace: Workplace;
  scoreAdjustment: number;
  badge?: 'Berlin' | 'Germany' | 'Remote Europe' | 'Remote worldwide' | 'region unverified' | 'location unknown';
};

export type EmploymentDecision = FilterDecision & {
  employmentTypes: EmploymentType[];
};

export type FreshnessDecision = FilterDecision & {
  postedAt?: string;
};

export type LanguageDecision = FilterDecision & {
  germanRequired: boolean;
};

export function evaluateRole(title: string): RoleDecision {
  if (JUNIOR_RE.test(title)) return { keep: false, family: null, reason: 'junior-or-entry-level' };
  if (OUT_OF_SCOPE_LEVEL_RE.test(title)) return { keep: false, family: null, reason: 'seniority-out-of-scope' };

  const family = detectRoleFamily(title);
  if (!family) return { keep: false, family: null, reason: 'role-family-mismatch' };
  if (MOBILE_RE.test(title)) return { keep: false, family, reason: 'discipline-out-of-scope' };

  const hasFrontendScope = FRONTEND_RE.test(title) || FULL_STACK_RE.test(title) || UI_RE.test(title);
  if (NON_PRODUCT_ENGINEERING_RE.test(title) && !hasFrontendScope) {
    return { keep: false, family, reason: 'discipline-out-of-scope' };
  }

  return { keep: true, family };
}

export function detectRoleFamily(title: string): RoleFamily | null {
  if (FRONTEND_RE.test(title) && ENGINEER_OR_DEVELOPER_RE.test(title)) return 'frontend';
  if (UI_RE.test(title) && ENGINEER_OR_DEVELOPER_RE.test(title)) return 'ui';
  if (PRODUCT_ENGINEER_RE.test(title)) return 'product';
  if (FULL_STACK_RE.test(title) && ENGINEER_OR_DEVELOPER_RE.test(title)) return 'full-stack';
  if (VUE_RE.test(title) && ENGINEER_OR_DEVELOPER_RE.test(title)) return 'frontend';
  if (SOFTWARE_ENGINEER_RE.test(title)) return 'software';
  return null;
}

export function evaluateLocation(
  raw: Pick<RawJob, 'location' | 'descriptionText' | 'remote' | 'tags'>,
): LocationDecision {
  const location = raw.location?.trim() ?? '';
  const tags = raw.tags?.join(' ') ?? '';
  const description = raw.descriptionText?.slice(0, 3_000) ?? '';
  const locationSignals = `${location} ${tags}`;
  const isHybrid = HYBRID_RE.test(locationSignals);
  const isRemote =
    raw.remote === true || isHybrid || REMOTE_RE.test(locationSignals) || DESCRIPTION_REMOTE_RE.test(description);
  const workplace: Workplace = isHybrid ? 'hybrid' : isRemote ? 'remote' : location ? 'onsite' : 'unknown';

  if (GERMANY_RE.test(locationSignals) || GERMANY_COUNTRY_CODE_RE.test(location)) {
    return {
      keep: true,
      workplace,
      scoreAdjustment: 0,
      badge: /berlin/i.test(locationSignals) ? 'Berlin' : 'Germany',
    };
  }

  if (isRemote) {
    if (WORLDWIDE_RE.test(locationSignals)) {
      return { keep: true, workplace, scoreAdjustment: 0, badge: 'Remote worldwide' };
    }
    if (EUROPE_RE.test(locationSignals) || EUROPE_COUNTRY_CODE_RE.test(location)) {
      return { keep: true, workplace, scoreAdjustment: 0, badge: 'Remote Europe' };
    }
    if (NON_EU_REMOTE_RE.test(locationSignals)) {
      return { keep: false, workplace, scoreAdjustment: 0, reason: 'remote-region-out-of-scope' };
    }

    return {
      keep: true,
      workplace,
      scoreAdjustment: -1,
      badge: 'region unverified',
      warnings: ['remote-region-unverified'],
    };
  }

  if (!location) {
    return {
      keep: true,
      workplace: 'unknown',
      scoreAdjustment: -1,
      badge: 'location unknown',
      warnings: ['location-unverified'],
    };
  }

  if (AMBIGUOUS_LOCATION_RE.test(location)) {
    return {
      keep: true,
      workplace: 'unknown',
      scoreAdjustment: -1,
      warnings: ['workplace-unverified'],
    };
  }

  return { keep: false, workplace: 'onsite', scoreAdjustment: 0, reason: 'onsite-outside-germany' };
}

export function evaluateEmploymentType(
  raw: Pick<RawJob, 'title' | 'tags' | 'jobTypes' | 'descriptionText'>,
): EmploymentDecision {
  const searchable = [raw.title, ...(raw.tags ?? []), ...(raw.jobTypes ?? []), raw.descriptionText?.slice(0, 1_500) ?? ''].join(
    ' ',
  );

  if (INTERNSHIP_RE.test(searchable)) {
    return { keep: false, reason: 'internship-or-student-role', employmentTypes: [] };
  }

  const employmentTypes: EmploymentType[] = [];
  if (FULL_TIME_RE.test(searchable)) employmentTypes.push('full-time');
  if (CONTRACT_RE.test(searchable)) employmentTypes.push('contract');
  if (FREELANCE_RE.test(searchable)) employmentTypes.push('freelance');

  const partTime = PART_TIME_RE.test(searchable);
  if (partTime && employmentTypes.length === 0) {
    return { keep: false, reason: 'part-time-only', employmentTypes: [] };
  }
  if (employmentTypes.length === 0) {
    return { keep: true, employmentTypes: ['unknown'], warnings: ['employment-type-unverified'] };
  }

  return {
    keep: true,
    employmentTypes,
    warnings: partTime ? ['also-offers-part-time'] : [],
  };
}

export function evaluateSeniority(title: string): FilterDecision & { seniority: Seniority } {
  if (JUNIOR_RE.test(title)) {
    return { keep: false, seniority: 'unknown', reason: 'junior-or-entry-level' };
  }
  if (OUT_OF_SCOPE_LEVEL_RE.test(title)) {
    return { keep: false, seniority: 'unknown', reason: 'seniority-out-of-scope' };
  }

  const senior = SENIOR_RE.test(title);
  const mid = MID_RE.test(title);
  if (senior && mid) return { keep: true, seniority: 'mixed' };
  if (senior) return { keep: true, seniority: 'senior' };
  if (mid) return { keep: true, seniority: 'mid' };

  return { keep: true, seniority: 'unknown', warnings: ['seniority-unverified'] };
}

export function evaluateFreshness(postedAt: string | undefined, now: Date, maxAgeDays: number): FreshnessDecision {
  if (!postedAt) return { keep: true, warnings: ['publication-date-unverified'] };

  const timestamp = Date.parse(postedAt);
  if (Number.isNaN(timestamp)) return { keep: true, warnings: ['publication-date-unverified'] };

  const normalized = new Date(timestamp).toISOString();
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1_000;
  if (timestamp < cutoff) return { keep: false, reason: 'older-than-14-days', postedAt: normalized };
  return { keep: true, postedAt: normalized };
}

export function evaluateLanguage(descriptionText: string, declaredLanguage?: string): LanguageDecision {
  const declared = declaredLanguage?.trim().toLowerCase() ?? '';
  if (declared && !/^(?:en(?:[-_].*)?|eng|english)$/.test(declared)) {
    const german = /^(?:de(?:[-_].*)?|deu|ger|german|deutsch)$/.test(declared);
    return {
      keep: false,
      germanRequired: german,
      reason: german ? 'german-language-listing' : 'non-english-listing',
    };
  }

  const sample = descriptionText.slice(0, 8_000);
  const sentences = sample.split(/(?<=[.!?\n])/);
  const explicitlyRequired = sentences.some((sentence) => {
    if (OPTIONAL_GERMAN_RE.test(sentence)) return false;
    return GERMAN_REQUIREMENT_RE.some((pattern) => pattern.test(sentence));
  });
  if (explicitlyRequired) {
    return { keep: false, germanRequired: true, reason: 'german-required' };
  }

  const tokens = sample.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let germanCount = 0;
  let englishCount = 0;
  for (const token of tokens) {
    if (GERMAN_WORDS.has(token)) germanCount += 1;
    if (ENGLISH_WORDS.has(token)) englishCount += 1;
  }
  if (germanCount >= 10 && germanCount > englishCount * 1.35) {
    return { keep: false, germanRequired: true, reason: 'german-language-listing' };
  }

  // A short feed summary can still be long enough to establish that it is not English.
  // Do not let an English title mask a non-English listing body.
  const hasEnoughTextToAssessLanguage = tokens.length >= 12;
  const detected = hasEnoughTextToAssessLanguage ? franc(sample, { minLength: 50 }) : 'und';
  const minimumEnglishSignals = Math.max(3, Math.floor(tokens.length * 0.02));
  const hasEnglishEvidence = englishCount >= minimumEnglishSignals;
  if (detected !== 'eng' && !hasEnglishEvidence && (detected !== 'und' || hasEnoughTextToAssessLanguage)) {
    return {
      keep: false,
      germanRequired: detected === 'deu',
      reason: detected === 'deu' ? 'german-language-listing' : 'non-english-listing',
    };
  }

  if (/\b(?:german|deutsch)\b/i.test(sample)) {
    return { keep: true, germanRequired: false, warnings: ['german-mentioned-not-required'] };
  }
  return {
    keep: true,
    germanRequired: false,
    warnings: sample && detected === 'und' ? ['listing-language-unverified'] : undefined,
  };
}

export function isGermanRequired(descriptionText: string): boolean {
  return evaluateLanguage(descriptionText).germanRequired;
}

export function detectTechnologies(input: {
  title: string;
  tags?: string[];
  descriptionText?: string;
  trustedVueSource?: boolean;
}): Technology[] {
  const searchable = `${input.title} ${(input.tags ?? []).join(' ')} ${input.descriptionText ?? ''}`;
  const technologies = new Set<Technology>();
  if (input.trustedVueSource || /\bvue(?:\.js|js)?\b/i.test(searchable)) technologies.add('vue');
  if (/\bnuxt(?:\.js|js)?\b/i.test(searchable)) {
    technologies.add('nuxt');
    technologies.add('vue');
  }
  if (REACT_RE.test(searchable)) technologies.add('react');
  return Array.from(technologies);
}

export function isVueRelevant(raw: Pick<RawJob, 'title' | 'tags' | 'descriptionText'>): FilterDecision {
  const technologies = detectTechnologies(raw);
  return technologies.includes('vue') || technologies.includes('nuxt')
    ? { keep: true }
    : { keep: false, reason: 'not-vue-relevant' };
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
  if (/\bvue(?:\.js|js)?\b/i.test(description)) {
    score += 1;
    reasons.push('Vue in description');
  }
  if (FRONTEND_RE.test(input.title)) {
    score += 1;
    reasons.push('Frontend role');
  }
  if (/berlin/i.test(location)) {
    score += 2;
    reasons.push('Berlin location');
  }
  if (REMOTE_RE.test(`${location} ${tagText}`) && EUROPE_RE.test(`${location} ${description} ${tagText}`)) {
    score += 2;
    reasons.push('Remote Europe');
  }
  if (/\btypescript\b/i.test(`${input.title} ${tagText} ${description}`)) {
    score += 1;
    reasons.push('TypeScript');
  }
  if (/\bnuxt(?:\.js|js)?\b/i.test(`${input.title} ${tagText} ${description}`)) {
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

export function hasLongExperienceRequirement(descriptionText: string): boolean {
  return LONG_EXPERIENCE_RE.test(descriptionText);
}
