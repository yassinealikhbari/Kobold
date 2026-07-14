import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobsStore } from './jobs';

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
