import { describe, expect, it } from 'vitest';

import { sourceAdapters } from './index.js';
import { splitCompanyAndTitle } from './weworkremotely.js';

describe('source registry', () => {
  it('has stable unique source names and no retired empty adapter', () => {
    const names = sourceAdapters.map((adapter) => adapter.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      'arbeitnow',
      'vuejobs',
      'berlinstartupjobs',
      'workingnomads',
      'remoteok',
      'remotive',
      'weworkremotely',
      'himalayas',
      'greenhouse',
      'lever',
      'ashby',
    ]);
  });

  it('splits the company prefix used by We Work Remotely', () => {
    expect(splitCompanyAndTitle('Acme: Senior Frontend Engineer')).toEqual({
      company: 'Acme',
      title: 'Senior Frontend Engineer',
    });
  });
});
