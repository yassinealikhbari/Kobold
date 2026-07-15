import { describe, expect, it } from 'vitest';

import {
  detectTechnologies,
  evaluateEmploymentType,
  evaluateFreshness,
  evaluateLanguage,
  evaluateLocation,
  evaluateRole,
  evaluateSeniority,
} from './filters.js';
import {
  buildDedupeKey,
  buildMergeKeys,
  canonicalizeUrl,
  extractApplyTarget,
  normalizeRawJob,
  normalizedTitleForDedupe,
  stripHtml,
} from './normalize.js';

describe('role and seniority eligibility', () => {
  it.each([
    ['Senior Frontend Engineer', 'frontend'],
    ['Mid-level Front-end Developer', 'frontend'],
    ['UI Engineer', 'ui'],
    ['Product Engineer', 'product'],
    ['Full Stack Engineer', 'full-stack'],
    ['Software Engineer', 'software'],
  ])('accepts %s as %s', (title, family) => {
    expect(evaluateRole(title)).toMatchObject({ keep: true, family });
  });

  it.each([
    ['Junior Frontend Engineer', 'junior-or-entry-level'],
    ['Lead Frontend Engineer', 'seniority-out-of-scope'],
    ['Backend Software Engineer', 'discipline-out-of-scope'],
    ['Product Manager', 'seniority-out-of-scope'],
    ['iOS Software Engineer', 'discipline-out-of-scope'],
  ])('rejects %s with a precise reason', (title, reason) => {
    expect(evaluateRole(title)).toMatchObject({ keep: false, reason });
  });

  it('keeps unknown seniority visible with a warning', () => {
    expect(evaluateSeniority('Frontend Engineer')).toMatchObject({
      keep: true,
      seniority: 'unknown',
      warnings: ['seniority-unverified'],
    });
  });

  it('treats Vue and Nuxt titles as frontend while preserving hard exclusions', () => {
    expect(evaluateRole('Vue.js Developer')).toMatchObject({ keep: true, family: 'frontend' });
    expect(evaluateRole('Nuxt Engineer')).toMatchObject({ keep: true, family: 'frontend' });
    expect(evaluateRole('Lead Vue.js Developer')).toMatchObject({
      keep: false,
      reason: 'seniority-out-of-scope',
    });
    expect(evaluateRole('Senior Security Engineer')).toMatchObject({
      keep: false,
      reason: 'role-family-mismatch',
    });
  });
});

describe('location and employment eligibility', () => {
  it('accepts all Germany locations and Berlin hybrid roles', () => {
    expect(evaluateLocation({ location: 'Munich, Germany' })).toMatchObject({
      keep: true,
      workplace: 'onsite',
      badge: 'Germany',
    });
    expect(evaluateLocation({ location: 'Berlin (hybrid)' })).toMatchObject({
      keep: true,
      workplace: 'hybrid',
      badge: 'Berlin',
    });
    expect(evaluateLocation({ location: 'Hamburg, DE' })).toMatchObject({ keep: true, badge: 'Germany' });
  });

  it('accepts Europe and worldwide remote but rejects US-only remote', () => {
    expect(evaluateLocation({ location: 'Remote - Europe' })).toMatchObject({ keep: true, badge: 'Remote Europe' });
    expect(evaluateLocation({ location: 'Remote worldwide' })).toMatchObject({
      keep: true,
      badge: 'Remote worldwide',
    });
    expect(evaluateLocation({ location: 'Remote - US only' })).toMatchObject({
      keep: false,
      reason: 'remote-region-out-of-scope',
    });
  });

  it('keeps unknown location visible and flags it', () => {
    expect(evaluateLocation({})).toMatchObject({
      keep: true,
      workplace: 'unknown',
      warnings: ['location-unverified'],
    });
  });

  it('accepts full-time, contract, and freelance while rejecting part-time-only', () => {
    expect(evaluateEmploymentType({ title: 'Frontend Engineer', jobTypes: ['Full-time'] })).toMatchObject({
      keep: true,
      employmentTypes: ['full-time'],
    });
    expect(evaluateEmploymentType({ title: 'Contract Frontend Engineer', jobTypes: [] })).toMatchObject({
      keep: true,
      employmentTypes: ['contract'],
    });
    expect(evaluateEmploymentType({ title: 'Freelance UI Engineer', jobTypes: [] })).toMatchObject({
      keep: true,
      employmentTypes: ['freelance'],
    });
    expect(evaluateEmploymentType({ title: 'Frontend Engineer - part-time', jobTypes: [] })).toMatchObject({
      keep: false,
      reason: 'part-time-only',
    });
  });
});

describe('language and freshness eligibility', () => {
  it('rejects explicit German requirements and German-language listings', () => {
    expect(evaluateLanguage('English is used internally. Fluent German is required for customers.')).toMatchObject({
      keep: false,
      reason: 'german-required',
    });
    expect(
      evaluateLanguage(
        'Wir suchen dich für unser Team. Du arbeitest mit der Produktgruppe und wir sind auf der Suche nach einer Person, die unser Produkt mit uns entwickeln wird.',
      ),
    ).toMatchObject({ keep: false, reason: 'german-language-listing' });
  });

  it('does not reject an English description because of one German word', () => {
    expect(evaluateLanguage('You will work with our Berlin team. Du is the name of an internal service.')).toMatchObject({
      keep: true,
      germanRequired: false,
    });
  });

  it('allows German when explicitly optional', () => {
    expect(evaluateLanguage('German is a plus but not required. English is our working language.')).toMatchObject({
      keep: true,
      germanRequired: false,
    });
  });

  it('rejects a non-English listing without guessing from a short title', () => {
    expect(
      evaluateLanguage(
        'Do naszego zespolu szukamy doswiadczonej osoby. Bedziesz rozwijac aplikacje internetowe, wspolpracowac z projektantami, dbac o jakosc kodu i wspierac innych programistow. Oferujemy elastyczne godziny pracy, prywatna opieke medyczna oraz mozliwosc rozwoju zawodowego w miedzynarodowym srodowisku.',
      ),
    ).toMatchObject({ keep: false, reason: 'non-english-listing' });
  });

  it('rejects a material non-English feed summary even when the title is English', () => {
    expect(
      evaluateLanguage(
        'Nasze realne wyzwania i codziennosc. Rozwijamy globalna platforme w branzy iGaming. Nasze systemy obsluguja ogromny ruch na zywo, ponad sto milionow zapytan dziennie.',
      ),
    ).toMatchObject({ keep: false, reason: 'non-english-listing' });
  });

  it('uses a strict 14-day freshness window and keeps unknown dates visible', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    expect(evaluateFreshness('2026-06-29T11:59:59.000Z', now, 14)).toMatchObject({
      keep: false,
      reason: 'older-than-14-days',
    });
    expect(evaluateFreshness('2026-06-30T12:00:00.000Z', now, 14)).toMatchObject({ keep: true });
    expect(evaluateFreshness(undefined, now, 14)).toMatchObject({
      keep: true,
      warnings: ['publication-date-unverified'],
    });
  });
});

describe('technology, identity, and normalization', () => {
  it('detects Vue and React independently and trusts VueJobs as Vue-related', () => {
    expect(detectTechnologies({ title: 'Frontend Engineer', descriptionText: 'Vue, Nuxt and React' })).toEqual([
      'vue',
      'nuxt',
      'react',
    ]);
    expect(detectTechnologies({ title: 'Software Engineer', trustedVueSource: true })).toEqual(['vue']);
  });

  it('applies profile filters to VueJobs listings like any other source', () => {
    const normalized = normalizeRawJob(
      {
        title: 'Staff Data Scientist',
        company: 'Example',
        location: 'Toronto, Canada',
        url: 'https://vuejobs.com/jobs/example-staff-data-scientist',
        tags: ['vue'],
        descriptionText:
          'You will build analytical products with our engineering team and work with product partners to improve customer outcomes across the company.',
        postedAt: '2026-07-13T00:00:00.000Z',
      },
      { source: 'vuejobs', now: new Date('2026-07-14T00:00:00.000Z') },
    );

    expect(normalized).toMatchObject({ keep: false, reason: 'seniority-out-of-scope' });
  });

  it('still hides old or non-English VueJobs listings', () => {
    const base = {
      title: 'Frontend Engineer',
      company: 'Example',
      location: 'Remote',
      url: 'https://vuejobs.com/jobs/example',
      tags: ['vue'],
    };
    expect(
      normalizeRawJob(
        { ...base, postedAt: '2026-06-01T00:00:00.000Z', descriptionText: 'Build Vue products with our team.' },
        { source: 'vuejobs', now: new Date('2026-07-14T00:00:00.000Z') },
      ),
    ).toMatchObject({ keep: false, reason: 'older-than-14-days' });
    expect(
      normalizeRawJob(
        { ...base, language: 'fr', postedAt: '2026-07-13T00:00:00.000Z' },
        { source: 'vuejobs', now: new Date('2026-07-14T00:00:00.000Z') },
      ),
    ).toMatchObject({ keep: false, reason: 'non-english-listing' });
  });

  it('canonicalizes tracking URLs into a stable source ID', () => {
    const first = normalizeRawJob(
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote Europe',
        url: 'https://jobs.example.com/42?utm_source=feed&team=web',
      },
      { source: 'example', now: new Date('2026-07-14T00:00:00.000Z') },
    );
    const second = normalizeRawJob(
      {
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote Europe',
        url: 'https://jobs.example.com/42?team=web&utm_campaign=test#apply',
      },
      { source: 'example', now: new Date('2026-07-14T00:00:00.000Z') },
    );

    expect(first.job?.id).toBe(second.job?.id);
    expect(canonicalizeUrl('https://jobs.example.com/42?utm_source=x&team=web#top')).toBe(
      'https://jobs.example.com/42?team=web',
    );
  });

  it('uses URL identities before a company/title/location fallback', () => {
    expect(
      buildMergeKeys({
        company: 'Acme',
        title: 'Frontend Engineer',
        location: 'Berlin',
        url: 'https://example.com/jobs/1',
      }),
    ).toEqual([
      'url:https://example.com/jobs/1',
      'role:acme::frontend-engineer::berlin',
    ]);
  });

  it('preserves legacy title/company helpers and ATS extraction', () => {
    expect(normalizedTitleForDedupe('Senior Vue Developer (m/w/d)')).toBe('senior-vue-developer');
    expect(buildDedupeKey('Acme GmbH', 'Senior Vue Developer')).toBe('acme::senior-vue-developer');
    expect(stripHtml('<p>Hello &amp; welcome</p><script>alert(1)</script>')).toBe('Hello & welcome');
    expect(extractApplyTarget('<a href="https://boards.greenhouse.io/acme/jobs/1">Apply</a>')).toEqual({
      applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
      ats: 'greenhouse',
    });
  });
});
