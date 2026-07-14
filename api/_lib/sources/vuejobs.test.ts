import { describe, expect, it } from 'vitest';

import { parseVueJobsDescription } from './vuejobs.js';

describe('VueJobs metadata parsing', () => {
  it('extracts employer and location and removes metadata from the description', () => {
    const parsed = parseVueJobsDescription(`
      <p><strong>Employer:</strong> Blue &amp; Binary</p>
      <p><strong>Location:</strong> Berlin / Remote Europe</p>
      <p>Build a Vue and Nuxt product with TypeScript.</p>
    `);

    expect(parsed).toEqual({
      company: 'Blue & Binary',
      location: 'Berlin / Remote Europe',
      descriptionHtml: '<p>Build a Vue and Nuxt product with TypeScript.</p>',
    });
  });
});
