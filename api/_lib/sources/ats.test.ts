import { describe, expect, it } from 'vitest';

import { mapAshbyJob } from './ashby.js';
import { ASHBY_BOARDS, GREENHOUSE_BOARDS, LEVER_BOARDS } from './ats-registry.js';
import { mapGreenhouseJob } from './greenhouse.js';
import { mapLeverJob } from './lever.js';

describe('public ATS adapters', () => {
  it('keeps each verified board token unique within its ATS', () => {
    for (const boards of [GREENHOUSE_BOARDS, LEVER_BOARDS, ASHBY_BOARDS]) {
      expect(new Set(boards.map((board) => board.token)).size).toBe(boards.length);
    }
  });

  it('maps Greenhouse content, metadata, language, and direct URLs', () => {
    expect(
      mapGreenhouseJob(
        { company: 'Acme', token: 'acme' },
        {
          title: 'Senior Frontend Engineer',
          absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/1',
          location: { name: 'Berlin, Germany' },
          updated_at: '2026-07-14T09:00:00Z',
          language: 'en',
          content: '&lt;p&gt;Build with React &amp;amp; TypeScript&lt;/p&gt;',
          metadata: [{ name: 'Employment Type', value: 'Full-time' }],
          departments: [{ name: 'Engineering' }],
        },
      ),
    ).toMatchObject({
      company: 'Acme',
      location: 'Berlin, Germany',
      applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1',
      descriptionHtml: '<p>Build with React & TypeScript</p>',
      language: 'en',
      jobTypes: ['Employment Type', 'Full-time'],
    });
  });

  it('maps Lever work mode, commitment, salary, and application URL', () => {
    expect(
      mapLeverJob(
        { company: 'Acme', token: 'acme' },
        {
          text: 'Frontend Engineer',
          categories: {
            location: 'Berlin',
            allLocations: ['Berlin', 'Remote - Germany'],
            commitment: 'Full-time',
            team: 'Web',
          },
          workplaceType: 'hybrid',
          hostedUrl: 'https://jobs.lever.co/acme/1',
          applyUrl: 'https://jobs.lever.co/acme/1/apply',
          salaryRange: { currency: 'EUR', min: 70_000, max: 90_000, interval: 'year' },
        },
      ),
    ).toMatchObject({
      location: 'Berlin / Remote - Germany',
      jobTypes: ['Full-time'],
      applyUrl: 'https://jobs.lever.co/acme/1/apply',
      salaryText: 'EUR 70000-90000 year',
    });
  });

  it('maps only the fields needed from an Ashby posting', () => {
    expect(
      mapAshbyJob(
        { company: 'Acme', token: 'acme' },
        {
          title: 'Product Engineer',
          location: 'Berlin',
          secondaryLocations: [{ location: 'Remote - Europe' }],
          department: 'Engineering',
          workplaceType: 'Hybrid',
          employmentType: 'FullTime',
          isRemote: false,
          jobUrl: 'https://jobs.ashbyhq.com/acme/1',
          applyUrl: 'https://jobs.ashbyhq.com/acme/1/application',
          publishedAt: '2026-07-14T09:00:00Z',
          compensation: { scrapeableCompensationSalarySummary: 'EUR 70K - 90K' },
        },
      ),
    ).toMatchObject({
      location: 'Berlin / Remote - Europe',
      tags: ['Engineering', 'Hybrid'],
      jobTypes: ['FullTime'],
      salaryText: 'EUR 70K - 90K',
    });
  });
});
