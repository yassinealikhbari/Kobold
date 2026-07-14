import { describe, expect, it, vi } from 'vitest';

import type { DiscoveredJob } from './job-discovery.js';
import {
  createJobNotificationService,
  type FingerprintRecord,
  type FingerprintRepository,
  type FingerprintWrite,
} from './job-notifications.js';
import { buildCombinedTelegramDigest } from './telegram.js';

class MemoryFingerprintRepository implements FingerprintRepository {
  readonly rows = new Map<string, FingerprintRecord & { sources: string[]; error?: string }>();

  async hasAny() {
    return this.rows.size > 0;
  }

  async find(fingerprints: string[]) {
    return fingerprints.flatMap((fingerprint) => {
      const row = this.rows.get(fingerprint);
      return row ? [{ fingerprint: row.fingerprint, notified_at: row.notified_at }] : [];
    });
  }

  async upsert(records: FingerprintWrite[]) {
    for (const record of records) {
      const existing = this.rows.get(record.fingerprint);
      this.rows.set(record.fingerprint, {
        fingerprint: record.fingerprint,
        sources: record.sources,
        notified_at: record.notified_at ?? existing?.notified_at ?? null,
      });
    }
  }

  async markAttempted() {}

  async markNotified(fingerprints: string[], notifiedAt: string) {
    for (const fingerprint of fingerprints) {
      const row = this.rows.get(fingerprint);
      if (row) this.rows.set(fingerprint, { ...row, notified_at: notifiedAt, error: undefined });
    }
  }

  async markFailed(fingerprints: string[], _attemptedAt: string, error: string) {
    for (const fingerprint of fingerprints) {
      const row = this.rows.get(fingerprint);
      if (row) this.rows.set(fingerprint, { ...row, error });
    }
  }
}

describe('job notification service', () => {
  it('establishes the first baseline without sending old jobs', async () => {
    const repository = new MemoryFingerprintRepository();
    const sendDigest = vi.fn();
    const process = createJobNotificationService({
      repository,
      notificationsEnabled: async () => true,
      sendDigest,
      now: () => new Date('2026-07-14T09:00:00Z'),
    });

    const result = await process([job('existing')]);

    expect(result).toMatchObject({ baselined: 1, sent: 0, pending: 0 });
    expect(repository.rows.get('existing')?.notified_at).toBe('2026-07-14T09:00:00.000Z');
    expect(sendDigest).not.toHaveBeenCalled();
  });

  it('retries a failed combined digest on the next scan', async () => {
    const repository = new MemoryFingerprintRepository();
    repository.rows.set('existing', {
      fingerprint: 'existing',
      sources: ['vuejobs'],
      notified_at: '2026-07-14T06:00:00.000Z',
    });
    const sendDigest = vi
      .fn()
      .mockResolvedValueOnce({ sentCount: 0, error: 'Telegram unavailable' })
      .mockResolvedValueOnce({ sentCount: 1, error: null });
    const process = createJobNotificationService({
      repository,
      notificationsEnabled: async () => true,
      sendDigest,
      now: () => new Date('2026-07-14T09:00:00Z'),
    });

    const failed = await process([job('existing'), job('new-job')]);
    const retried = await process([job('existing'), job('new-job')]);

    expect(failed).toMatchObject({ newFingerprints: 1, candidates: 1, sent: 0, pending: 1 });
    expect(retried).toMatchObject({ newFingerprints: 0, candidates: 1, sent: 1, pending: 0 });
    expect(sendDigest).toHaveBeenCalledTimes(2);
    expect(repository.rows.get('new-job')?.notified_at).toBe('2026-07-14T09:00:00.000Z');
  });

  it('leaves jobs beyond one Telegram message pending', async () => {
    const repository = new MemoryFingerprintRepository();
    repository.rows.set('baseline', {
      fingerprint: 'baseline',
      sources: ['vuejobs'],
      notified_at: '2026-07-14T06:00:00.000Z',
    });
    const process = createJobNotificationService({
      repository,
      notificationsEnabled: async () => true,
      sendDigest: async () => ({ sentCount: 1, error: null }),
      now: () => new Date('2026-07-14T09:00:00Z'),
    });

    const result = await process([job('first'), job('second')]);

    expect(result).toMatchObject({ candidates: 2, sent: 1, pending: 1 });
    expect(repository.rows.get('first')?.notified_at).toBeTruthy();
    expect(repository.rows.get('second')?.notified_at).toBeNull();
  });
});

describe('combined Telegram digest', () => {
  it('builds one bounded message and reports how many jobs fit', () => {
    const jobs = Array.from({ length: 8 }, (_, index) => job(`job-${index}`));
    const digest = buildCombinedTelegramDigest(
      jobs.map((item) => ({
        id: item.id,
        title: item.title.repeat(3),
        company: item.company,
        location: item.location,
        sources: item.sources,
        url: item.url,
      })),
      500,
    );

    expect(digest.text.length).toBeLessThanOrEqual(500);
    expect(digest.included).toBeGreaterThan(0);
    expect(digest.included).toBeLessThan(jobs.length);
    expect(digest.text).toContain('queued for the next digest');
  });
});

function job(id: string): DiscoveredJob {
  return {
    id,
    title: `Frontend Engineer ${id}`,
    company: 'Example GmbH',
    role_family: 'frontend',
    location: 'Berlin, Germany',
    workplace: 'hybrid',
    url: `https://example.com/jobs/${id}`,
    apply_url: null,
    ats: null,
    sources: ['vuejobs'],
    source_listings: [{ source: 'vuejobs', url: `https://example.com/jobs/${id}`, apply_url: null }],
    tags: [],
    technologies: ['vue'],
    employment_types: ['full-time'],
    description_html: null,
    description_text: null,
    seniority: 'senior',
    german_required: false,
    salary_text: null,
    score: 0,
    score_reasons: [],
    eligibility_warnings: [],
    fit: {
      label: 'unrated',
      score: 0,
      reasons: [],
      risks: [],
      matched_skills: [],
      requested_skills: [],
    },
    posted_at: '2026-07-14T08:00:00Z',
    first_seen_at: '2026-07-14T09:00:00Z',
    last_seen_at: '2026-07-14T09:00:00Z',
    status: 'active',
    application: null,
  };
}
