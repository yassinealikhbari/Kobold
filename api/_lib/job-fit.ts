import type { DiscoveredJob } from './job-discovery.js';
import type { CandidateProfile } from './profile.js';

export type FitLabel = 'strong' | 'possible' | 'stretch' | 'unrated';

export type JobFit = {
  label: FitLabel;
  score: number;
  reasons: string[];
  risks: string[];
  matched_skills: string[];
  requested_skills: string[];
};

type SkillSignal = {
  label: string;
  pattern: RegExp;
};

const SKILL_SIGNALS: SkillSignal[] = [
  { label: 'Vue', pattern: /\bvue(?:\.js|js)?\b/i },
  { label: 'Nuxt', pattern: /\bnuxt(?:\.js|js)?\b/i },
  { label: 'React', pattern: /\breact(?:\.js|js)?\b/i },
  { label: 'TypeScript', pattern: /\btypescript\b/i },
  { label: 'JavaScript', pattern: /\bjavascript\b/i },
  { label: 'HTML', pattern: /\bhtml5?\b/i },
  { label: 'CSS', pattern: /\bcss3?\b|\bsass\b|\bscss\b/i },
  { label: 'Pinia', pattern: /\bpinia\b/i },
  { label: 'Vite', pattern: /\bvite\b/i },
  { label: 'Node.js', pattern: /\bnode(?:\.js|js)?\b/i },
  { label: 'GraphQL', pattern: /\bgraphql\b/i },
  { label: 'REST APIs', pattern: /\brest(?:ful)?\s+api(?:s)?\b|\bapi integration\b/i },
  { label: 'Playwright', pattern: /\bplaywright\b/i },
  { label: 'Cypress', pattern: /\bcypress\b/i },
  { label: 'Vitest', pattern: /\bvitest\b/i },
  { label: 'Jest', pattern: /\bjest\b/i },
  { label: 'AWS', pattern: /\baws\b|\bamazon web services\b/i },
  { label: 'Azure', pattern: /\bazure\b/i },
  { label: 'GCP', pattern: /\bgcp\b|\bgoogle cloud\b/i },
  { label: 'Figma', pattern: /\bfigma\b/i },
  { label: 'Accessibility', pattern: /\baccessibility\b|\ba11y\b|\bwcag\b/i },
  { label: 'Design systems', pattern: /\bdesign systems?\b|\bcomponent librar(?:y|ies)\b/i },
];

const CORE_TECH_LABELS: Record<string, string> = {
  vue: 'Vue',
  nuxt: 'Nuxt',
  react: 'React',
};

export function evaluateJobFit(job: DiscoveredJob, profile: CandidateProfile): JobFit {
  const profileText = profileCorpus(profile);
  if (!hasFitProfile(profile, profileText)) {
    return {
      label: 'unrated',
      score: 0,
      reasons: ['Complete skills, summary, or work history to calculate fit'],
      risks: [],
      matched_skills: [],
      requested_skills: detectSkills(jobCorpus(job)),
    };
  }

  const requestedSkills = detectSkills(jobCorpus(job));
  const matchedSkills = requestedSkills.filter((skill) => skillMatches(skill, profileText));
  const unmatchedSkills = requestedSkills.filter((skill) => !matchedSkills.includes(skill));
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 40;

  const roleAlignment = evaluateRoleAlignment(job, profileText);
  score += roleAlignment.points;
  if (roleAlignment.reason) reasons.push(roleAlignment.reason);
  if (roleAlignment.risk) risks.push(roleAlignment.risk);

  const coreSkills = job.technologies.map((technology) => CORE_TECH_LABELS[technology]).filter(Boolean);
  const matchedCore = coreSkills.filter((skill) => skillMatches(skill, profileText));
  if (coreSkills.length > 0) {
    const coreRatio = matchedCore.length / coreSkills.length;
    score += Math.round(coreRatio * 25);
    if (matchedCore.length > 0) reasons.push(`Profile evidence for ${matchedCore.join(' and ')}`);
    const missingCore = coreSkills.filter((skill) => !matchedCore.includes(skill));
    if (missingCore.length > 0) risks.push(`No profile evidence for ${missingCore.join(' or ')}`);
    if (matchedCore.length === 0) score -= 15;
  } else {
    score += 8;
  }

  if (requestedSkills.length > 0) {
    const skillRatio = matchedSkills.length / requestedSkills.length;
    score += Math.round(skillRatio * 20);
    const supporting = matchedSkills.filter((skill) => !matchedCore.includes(skill)).slice(0, 4);
    if (supporting.length > 0) reasons.push(`Relevant skills: ${supporting.join(', ')}`);
  } else {
    score += 8;
    reasons.push('Listing has few explicit technology requirements');
  }

  const experience = evaluateExperience(job, profile.experience_years ?? 5.5);
  score += experience.points;
  if (experience.reason) reasons.push(experience.reason);
  if (experience.risk) risks.push(experience.risk);

  const missingSupporting = unmatchedSkills.filter((skill) => !coreSkills.includes(skill)).slice(0, 3);
  if (missingSupporting.length > 0) {
    risks.push(`Verify experience with ${missingSupporting.join(', ')}`);
  }

  for (const warning of job.eligibility_warnings) {
    const risk = eligibilityRisk(warning);
    if (risk) risks.push(risk);
  }
  score -= Math.min(15, job.eligibility_warnings.length * 3);

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    label: normalizedScore >= 75 ? 'strong' : normalizedScore >= 55 ? 'possible' : 'stretch',
    score: normalizedScore,
    reasons: unique(reasons).slice(0, 4),
    risks: unique(risks).slice(0, 4),
    matched_skills: unique(matchedSkills),
    requested_skills: unique(requestedSkills),
  };
}

export function personalizeJobs(jobs: DiscoveredJob[], profile: CandidateProfile): DiscoveredJob[] {
  return jobs.map((job) => ({ ...job, fit: evaluateJobFit(job, profile) }));
}

export function unratedJobFit(): JobFit {
  return {
    label: 'unrated',
    score: 0,
    reasons: ['Profile fit has not been calculated'],
    risks: [],
    matched_skills: [],
    requested_skills: [],
  };
}

function profileCorpus(profile: CandidateProfile): string {
  return [
    profile.summary ?? '',
    ...profile.skills,
    ...profile.work_history.flatMap((work) => [work.role, ...work.highlights]),
  ].join(' ');
}

function jobCorpus(job: DiscoveredJob): string {
  return [job.title, ...job.tags, job.description_text ?? ''].join(' ');
}

function hasFitProfile(profile: CandidateProfile, corpus: string): boolean {
  return Boolean(corpus.trim() && (profile.skills.length > 0 || profile.summary || profile.work_history.length > 0));
}

function detectSkills(text: string): string[] {
  return SKILL_SIGNALS.filter((skill) => skill.pattern.test(text)).map((skill) => skill.label);
}

function skillMatches(skill: string, profileText: string): boolean {
  const signal = SKILL_SIGNALS.find((candidate) => candidate.label === skill);
  return signal ? signal.pattern.test(profileText) : false;
}

function evaluateRoleAlignment(
  job: DiscoveredJob,
  profileText: string,
): { points: number; reason?: string; risk?: string } {
  const frontendProfile = /\bfront[\s-]?end\b|\bui engineer\b|\bvue\b|\breact\b/i.test(profileText);
  const fullStackProfile = /\bfull[\s-]?stack\b|\bnode(?:\.js|js)?\b/i.test(profileText);
  const productProfile = /\bproduct engineer\b|\bproduct development\b/i.test(profileText);

  if ((job.role_family === 'frontend' || job.role_family === 'ui') && frontendProfile) {
    return { points: 15, reason: 'Role aligns with frontend experience' };
  }
  if (job.role_family === 'full-stack' && frontendProfile && fullStackProfile) {
    return { points: 15, reason: 'Role aligns with full-stack experience' };
  }
  if (job.role_family === 'product' && (frontendProfile || productProfile)) {
    return { points: 12, reason: 'Product engineering overlaps with profile experience' };
  }
  if (job.role_family === 'software' && frontendProfile) {
    return { points: 8, reason: 'Software role overlaps with frontend experience' };
  }
  return { points: 2, risk: 'Role-family alignment is not explicit in the profile' };
}

function evaluateExperience(
  job: DiscoveredJob,
  experienceYears: number,
): { points: number; reason?: string; risk?: string } {
  const requiredYears = extractRequiredYears(job.description_text ?? '');
  const baseline = experienceLabel(experienceYears);
  if (requiredYears === null) {
    return { points: 10, reason: `${baseline} aligns with the target seniority` };
  }
  if (requiredYears <= experienceYears + 0.5) {
    return { points: 15, reason: `${baseline} meets the stated ${requiredYears}-year requirement` };
  }
  return {
    points: -10,
    risk: `Listing asks for ${requiredYears}+ years; profile baseline is ${baseline.toLowerCase()}`,
  };
}

function extractRequiredYears(description: string): number | null {
  const requirementText = description
    .split(/(?<=[.!?\n])/)
    .filter((sentence) =>
      /\b(?:experience|requires?|required|requirements?|minimum|at least|you have|you bring|background)\b/i.test(
        sentence,
      ),
    )
    .join(' ');
  const matches = Array.from(requirementText.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi))
    .map((match) => Number(match[1]))
    .filter((years) => years > 0 && years <= 15);
  return matches.length > 0 ? Math.max(...matches) : null;
}

function experienceLabel(years: number): string {
  if (years >= 5 && years < 7) return '5-6 years of experience';
  const rounded = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${rounded} years of experience`;
}

function eligibilityRisk(warning: string): string | null {
  if (warning.startsWith('outside-profile-')) {
    return `Outside target profile: ${warning.slice('outside-profile-'.length).replaceAll('-', ' ')}`;
  }
  const risks: Record<string, string> = {
    'remote-region-unverified': 'Confirm that remote work is available from Germany',
    'location-unverified': 'Confirm the work location',
    'workplace-unverified': 'Confirm remote, hybrid, or onsite expectations',
    'employment-type-unverified': 'Confirm the employment type',
    'seniority-unverified': 'Confirm the expected seniority',
    'publication-date-unverified': 'Publication date is unverified',
    'asks-7-plus-years': 'Experience requirement may exceed the 5-6 year baseline',
    'technology-unclassified': 'Technology stack is not explicit',
    'german-mentioned-not-required': 'Confirm that German is not required',
    'listing-language-unverified': 'Confirm that the listing is in English',
  };
  return risks[warning] ?? null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
