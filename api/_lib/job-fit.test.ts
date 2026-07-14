import { describe, expect, it } from 'vitest';

import type { DiscoveredJob } from './job-discovery.js';
import { evaluateJobFit } from './job-fit.js';
import type { CandidateProfile } from './profile.js';

const profile: CandidateProfile = {
  id: 1,
  full_name: 'Yassine',
  email: null,
  phone: null,
  location: 'Berlin, Germany',
  linkedin: null,
  github: null,
  portfolio: null,
  summary: 'Frontend engineer building accessible product interfaces with Vue and TypeScript.',
  skills: ['Vue.js', 'Nuxt', 'TypeScript', 'Pinia', 'Vitest', 'Figma'],
  languages: [{ lang: 'English', level: 'Fluent' }],
  work_history: [
    {
      company: 'Example',
      role: 'Frontend Engineer',
      from: '2020',
      to: 'Present',
      highlights: ['Built a Vue design system and tested it with Vitest.'],
    },
  ],
  experience_years: 5.5,
  cv_path: 'cv.pdf',
  updated_at: '2026-07-14T09:00:00Z',
};

describe('personalized job fit', () => {
  it('rates a matching Vue role strongly with concrete evidence', () => {
    const fit = evaluateJobFit(job(), profile);

    expect(fit.label).toBe('strong');
    expect(fit.matched_skills).toEqual(expect.arrayContaining(['Vue', 'Nuxt', 'TypeScript', 'Pinia']));
    expect(fit.reasons.join(' ')).toMatch(/frontend experience/i);
  });

  it('keeps a React role but surfaces absent profile evidence', () => {
    const fit = evaluateJobFit(
      job({
        technologies: ['react'],
        title: 'Frontend Engineer, React',
        description_text: 'Build React and TypeScript applications.',
      }),
      profile,
    );

    expect(fit.label).not.toBe('strong');
    expect(fit.risks).toContain('No profile evidence for React');
  });

  it('flags requirements above the candidate experience baseline', () => {
    const fit = evaluateJobFit(job({ description_text: 'Requires 8+ years with Vue and TypeScript.' }), profile);

    expect(fit.risks.join(' ')).toMatch(/asks for 8\+ years/i);
  });

  it('ignores company-age copy that is not an experience requirement', () => {
    const fit = evaluateJobFit(
      job({ description_text: 'Our company has served customers for 12 years. Build Vue and TypeScript products.' }),
      profile,
    );

    expect(fit.risks.join(' ')).not.toMatch(/asks for 12/i);
  });

  it('requests profile data instead of guessing', () => {
    const fit = evaluateJobFit(job(), {
      ...profile,
      summary: null,
      skills: [],
      work_history: [],
    });

    expect(fit.label).toBe('unrated');
    expect(fit.score).toBe(0);
  });
});

function job(patch: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    id: 'job-1',
    title: 'Senior Vue Frontend Engineer',
    company: 'Example GmbH',
    role_family: 'frontend',
    location: 'Berlin, Germany',
    workplace: 'hybrid',
    url: 'https://example.com/jobs/1',
    apply_url: null,
    ats: null,
    sources: ['vuejobs'],
    source_listings: [{ source: 'vuejobs', url: 'https://example.com/jobs/1', apply_url: null }],
    tags: ['Vue', 'Nuxt', 'TypeScript'],
    technologies: ['vue', 'nuxt'],
    employment_types: ['full-time'],
    description_html: null,
    description_text: 'Build Vue, Nuxt, TypeScript, and Pinia product interfaces. 5 years experience.',
    seniority: 'senior',
    german_required: false,
    salary_text: null,
    score: 8,
    score_reasons: [],
    eligibility_warnings: [],
    profile_eligible: true,
    posted_at: '2026-07-14T08:00:00Z',
    first_seen_at: '2026-07-14T09:00:00Z',
    last_seen_at: '2026-07-14T09:00:00Z',
    status: 'active',
    application: null,
    fit: {
      label: 'unrated',
      score: 0,
      reasons: [],
      risks: [],
      matched_skills: [],
      requested_skills: [],
    },
    ...patch,
  };
}
