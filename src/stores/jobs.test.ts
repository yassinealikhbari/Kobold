import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Job } from '@/types/jobs';

import { useJobsStore } from './jobs';

const job = (id: string) => ({ id, fit: { score: 0 }, posted_at: null }) as Job;

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

describe('jobs local inbox state', () => {
  beforeEach(() => {
    storage.clear();
    setActivePinia(createPinia());
  });

  it('restores an unread job after undoing save', () => {
    const jobs = useJobsStore();
    const previousState = jobs.localStateFor('job-1');

    jobs.toggleSaved('job-1');
    expect(jobs.localStateFor('job-1')).toEqual({ seen: true, saved: true, dismissed: false });

    jobs.restoreLocalState('job-1', previousState);
    expect(jobs.localStateFor('job-1')).toEqual({ seen: false, saved: false, dismissed: false });
  });

  it('restores saved state after undoing dismiss', () => {
    const jobs = useJobsStore();
    jobs.toggleSaved('job-2');
    const previousState = jobs.localStateFor('job-2');

    jobs.dismissJob('job-2');
    expect(jobs.localStateFor('job-2')).toEqual({ seen: true, saved: false, dismissed: true });

    jobs.restoreLocalState('job-2', previousState);
    expect(jobs.localStateFor('job-2')).toEqual({ seen: true, saved: true, dismissed: false });
  });
});

describe('new inbox view', () => {
  beforeEach(() => {
    storage.clear();
    setActivePinia(createPinia());
  });

  it('keeps an opened job in New until it is dismissed', () => {
    const jobs = useJobsStore();
    jobs.jobs = [job('job-1'), job('job-2')];

    jobs.markSeen('job-1');
    expect(jobs.filteredJobs.map((item) => item.id)).toEqual(['job-1', 'job-2']);
    expect(jobs.inboxCounts.new).toBe(2);

    jobs.dismissJob('job-1');
    expect(jobs.filteredJobs.map((item) => item.id)).toEqual(['job-2']);
    expect(jobs.inboxCounts.new).toBe(1);
  });

  it('drops reviewed jobs from New once sources are refreshed', async () => {
    const jobs = useJobsStore();
    jobs.jobs = [job('job-1'), job('job-2')];
    jobs.markSeen('job-1');

    vi.spyOn(jobs, 'fetchJobs').mockResolvedValue(undefined);
    await jobs.refreshSources();

    expect(jobs.filteredJobs.map((item) => item.id)).toEqual(['job-2']);
  });
});
