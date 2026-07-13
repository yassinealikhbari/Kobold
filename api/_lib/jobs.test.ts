import { describe, expect, it } from 'vitest';

import { serializeJob } from './jobs.js';

describe('serializeJob', () => {
  it('supplies empty score reasons for legacy rows', () => {
    const job = serializeJob({
      id: 'job-1',
      title: 'Vue Engineer',
      company: 'Acme',
      location: 'Berlin',
      workplace: 'hybrid',
      url: 'https://example.com/jobs/1',
      apply_url: null,
      ats: null,
      sources: ['vuejobs'],
      tags: [],
      description_html: null,
      description_text: null,
      seniority: 'mid',
      german_required: false,
      salary_text: null,
      score: 6,
      posted_at: null,
      first_seen_at: '2026-07-13T00:00:00.000Z',
      last_seen_at: '2026-07-13T00:00:00.000Z',
      status: 'active',
    });

    expect(job.score_reasons).toEqual([]);
  });
});
