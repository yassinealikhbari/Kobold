import { describe, expect, it, vi } from 'vitest';

import { createJobDiscovery } from './job-discovery.js';
import type { RawJob, SourceAdapter } from './sources/types.js';

const NOW = new Date('2026-07-14T12:00:00.000Z');

describe('job discovery interface', () => {
  it('isolates source failures, explains exclusions, deduplicates, and sorts newest first', async () => {
    const sourceA = adapter('source-a', [
      job({ title: 'Frontend Engineer', company: 'Acme', url: 'https://a.example/jobs/acme', postedAt: '2026-07-13' }),
      job({
        title: 'Frontend Engineer',
        company: 'Acme',
        url: 'https://a.example/jobs/acme?utm_source=rss',
        postedAt: '2026-07-13',
      }),
      job({ title: 'UI Engineer', company: 'Beta', url: 'https://a.example/jobs/beta', postedAt: '2026-07-10' }),
      job({ title: 'Frontend Engineer', company: 'Old', url: 'https://a.example/jobs/old', postedAt: '2026-06-01' }),
      job({
        title: 'Frontend Engineer',
        company: 'German',
        url: 'https://a.example/jobs/german',
        descriptionText: 'Fluent German is required.',
      }),
      job({ title: 'Backend Engineer', company: 'Wrong', url: 'https://a.example/jobs/backend' }),
      job({
        title: 'Frontend Engineer - part-time',
        company: 'Part',
        url: 'https://a.example/jobs/part',
        tags: [],
      }),
    ]);
    const sourceB = adapter('source-b', [
      job({
        title: 'Frontend Engineer',
        company: 'Acme',
        url: 'https://b.example/roles/42',
        postedAt: '2026-07-13',
        descriptionText: 'A richer role description using React and TypeScript for a customer-facing product.',
      }),
    ]);
    const failed: SourceAdapter = {
      name: 'failed-source',
      fetchJobs: vi.fn().mockRejectedValue(new Error('upstream unavailable')),
    };
    const discovery = createJobDiscovery({ adapters: [sourceA, sourceB, failed] });

    const result = await discovery.discoverJobs({ now: NOW });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.map((item) => item.company)).toEqual(['Acme', 'Beta']);
    expect(result.jobs[0]).toMatchObject({
      sources: ['source-a', 'source-b'],
      technologies: ['react'],
      posted_at: '2026-07-13T00:00:00.000Z',
    });
    expect(result.jobs[0]?.description_text).toContain('richer role description');
    expect(result.coverage).toEqual([
      expect.objectContaining({
        source: 'source-a',
        status: 'ok',
        fetched: 7,
        parsed: 7,
        eligible: 3,
        returned: 2,
        duplicates: 1,
        excluded: {
          'older-than-14-days': 1,
          'german-required': 1,
          'role-family-mismatch': 1,
          'part-time-only': 1,
        },
      }),
      expect.objectContaining({ source: 'source-b', eligible: 1, returned: 1, duplicates: 1 }),
      expect.objectContaining({ source: 'failed-source', status: 'failed', error: 'upstream unavailable' }),
    ]);
    expect(result.issues).toContainEqual({
      source: 'failed-source',
      error: 'upstream unavailable',
      severity: 'error',
    });
  });

  it('reuses source snapshots and resolves detail records through the same interface', async () => {
    let nowMs = NOW.getTime();
    const fetchJobs = vi.fn().mockResolvedValue({
      jobs: [job({ title: 'Product Engineer', company: 'Gamma', url: 'https://example.com/gamma' })],
    });
    const discovery = createJobDiscovery({
      adapters: [{ name: 'careers', fetchJobs }],
      cacheTtlMs: 60_000,
      clock: () => nowMs,
    });

    const first = await discovery.discoverJobs();
    const second = await discovery.discoverJobs();
    const detail = await discovery.findDiscoveredJob({ id: first.jobs[0]?.id ?? '', source: 'careers' });

    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(detail?.company).toBe('Gamma');
    expect(fetchJobs).toHaveBeenCalledTimes(1);

    nowMs += 60_001;
    await discovery.discoverJobs();
    expect(fetchJobs).toHaveBeenCalledTimes(2);
  });

  it('returns a diagnostic instead of silently ignoring an unknown source', async () => {
    const discovery = createJobDiscovery({ adapters: [] });
    const result = await discovery.discoverJobs({ sources: ['missing'] });
    expect(result.jobs).toEqual([]);
    expect(result.coverage[0]).toMatchObject({ source: 'missing', status: 'failed' });
  });
});

function adapter(name: string, jobs: RawJob[]): SourceAdapter {
  return { name, fetchJobs: vi.fn().mockResolvedValue({ jobs }) };
}

function job(overrides: Partial<RawJob>): RawJob {
  return {
    title: 'Frontend Engineer',
    company: 'Example',
    location: 'Remote Europe',
    url: 'https://example.com/job',
    tags: ['full-time'],
    descriptionText: 'English is the working language.',
    postedAt: '2026-07-12T00:00:00.000Z',
    ...overrides,
  };
}
