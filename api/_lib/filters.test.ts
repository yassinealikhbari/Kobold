import { describe, expect, it } from 'vitest';

import {
  evaluateEmploymentType,
  evaluateLocation,
  evaluateSeniority,
  isGermanRequired,
  isVueRelevant,
  scoreJob,
  scoreJobDetails,
} from './filters.js';
import { buildDedupeKey, extractApplyTarget, normalizeRawJob, normalizedTitleForDedupe, stripHtml } from './normalize.js';

describe('Vue relevance', () => {
  it('keeps strong title and tag matches', () => {
    expect(isVueRelevant({ title: 'Senior Vue Developer', tags: [], descriptionText: '' }).keep).toBe(true);
    expect(isVueRelevant({ title: 'Frontend Developer', tags: ['Nuxt'], descriptionText: '' }).keep).toBe(true);
  });

  it('keeps weak description matches only for plausibly frontend titles', () => {
    expect(isVueRelevant({ title: 'Software Engineer', tags: [], descriptionText: 'Build with Vue.js' }).keep).toBe(
      true,
    );
    expect(isVueRelevant({ title: 'Backend Engineer', tags: [], descriptionText: 'Stack includes Vue.js' }).keep).toBe(
      false,
    );
  });
});

describe('Location filtering', () => {
  it('keeps Berlin and multi-location Berlin jobs', () => {
    expect(evaluateLocation({ location: 'Hamburg, Berlin, Munich' })).toMatchObject({
      keep: true,
      workplace: 'onsite',
      badge: 'Berlin',
    });
  });

  it('keeps remote Europe jobs', () => {
    expect(evaluateLocation({ location: 'Remote CET', remote: true })).toMatchObject({
      keep: true,
      workplace: 'remote',
      badge: 'Remote EU',
    });
  });

  it('discards US-only remote jobs', () => {
    expect(evaluateLocation({ location: 'Remote US only', remote: true })).toMatchObject({
      keep: false,
      reason: 'remote-non-eu',
    });
  });

  it('keeps remote jobs with unverified region at a score penalty', () => {
    expect(evaluateLocation({ location: 'Remote', remote: true })).toMatchObject({
      keep: true,
      scoreAdjustment: -1,
      badge: 'region unverified',
    });
  });

  it('keeps jobs with no location with a score penalty', () => {
    expect(evaluateLocation({})).toMatchObject({
      keep: true,
      workplace: 'unknown',
      scoreAdjustment: -1,
      badge: 'location unknown',
    });
  });
});

describe('Employment type and seniority', () => {
  it('filters part-time and freelance unless full-time is explicit', () => {
    expect(evaluateEmploymentType({ title: 'Vue Developer part time' }).keep).toBe(false);
    expect(evaluateEmploymentType({ title: 'Vue Developer full-time or contract' }).keep).toBe(true);
  });

  it('filters junior and classifies seniority', () => {
    expect(evaluateSeniority('Junior Vue Developer')).toMatchObject({ keep: false });
    expect(evaluateSeniority('Senior Vue Developer')).toMatchObject({ keep: true, seniority: 'senior' });
    expect(evaluateSeniority('Mid / Senior Vue Developer')).toMatchObject({ keep: true, seniority: 'mixed' });
    expect(evaluateSeniority('Intermediate Vue Developer')).toMatchObject({ keep: true, seniority: 'mid' });
  });
});

describe('German requirement detection', () => {
  it('detects German-language descriptions', () => {
    expect(isGermanRequired('Wir suchen dich und du arbeitest mit der die das für unser Team.')).toBe(true);
  });

  it('detects explicit German requirements', () => {
    expect(isGermanRequired('You must have fluent German to work with customers.')).toBe(true);
    expect(isGermanRequired('Native or C1 German required.')).toBe(true);
  });

  it('allows German as a plus', () => {
    expect(isGermanRequired('German is a plus, but not required for this role.')).toBe(false);
  });

  it('does not treat m/w/d title suffixes as German requirement signals', () => {
    const result = normalizeRawJob({
      title: 'Vue Developer (m/w/d)',
      company: 'Acme GmbH',
      location: 'Berlin',
      url: 'https://example.com/job',
      descriptionText: 'The team builds Vue apps with TypeScript.',
    });

    expect(result.keep).toBe(true);
  });
});

describe('Scoring', () => {
  it('scores the specified positive and negative signals', () => {
    expect(
      scoreJob({
        title: 'Mid Nuxt Developer',
        tags: ['vue', 'remote'],
        location: 'Remote Europe',
        descriptionText: 'TypeScript and 8 years experience.',
        seniority: 'mid',
        salaryText: 'EUR 70k',
      }),
    ).toBe(9);
  });

  it('clamps scores', () => {
    expect(
      scoreJob({
        title: 'Backend',
        descriptionText: '10 years experience.',
        seniority: 'unknown',
        locationScoreAdjustment: -5,
      }),
    ).toBe(-3);
  });

  it('returns score evidence for the board', () => {
    expect(
      scoreJobDetails({
        title: 'Vue Engineer',
        tags: ['TypeScript'],
        location: 'Berlin',
        descriptionText: 'Build with Nuxt.',
        seniority: 'mid',
      }),
    ).toMatchObject({
      score: 8,
      reasons: ['Vue or Nuxt in title', 'Berlin location', 'TypeScript', 'Nuxt', 'Mid-level scope'],
    });
  });
});

describe('Dedupe and normalization', () => {
  it('collides m/w/d title variants', () => {
    expect(normalizedTitleForDedupe('Senior Vue Developer (m/w/d)')).toBe(
      normalizedTitleForDedupe('Senior Vue Developer'),
    );
  });

  it('keeps senior and mid jobs separate', () => {
    expect(buildDedupeKey('Acme GmbH', 'Senior Vue Developer')).not.toBe(
      buildDedupeKey('Acme GmbH', 'Mid Vue Developer'),
    );
  });

  it('uses hostname fallback for unknown RSS companies', () => {
    expect(buildDedupeKey('(see listing)', 'Vue Developer', 'https://jobs.example.com/role')).toBe(
      'jobs-example-com::vue-developer',
    );
  });

  it('strips HTML and extracts ATS links', () => {
    expect(stripHtml('<p>Hello &amp; welcome</p><script>alert(1)</script>')).toBe('Hello & welcome');
    expect(extractApplyTarget('<a href="https://boards.greenhouse.io/acme/jobs/1">Apply</a>')).toEqual({
      applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
      ats: 'greenhouse',
    });
  });
});
