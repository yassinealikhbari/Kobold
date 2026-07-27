import { describe, expect, it } from 'vitest';

import {
  isWorkspaceMode,
  resolveWorkspaceMode,
  workspaceLandingPath,
  workspaceModeForPath,
} from './workspace-mode';

describe('workspace mode routing', () => {
  it.each([
    ['/freelance', 'freelance'],
    ['/freelance/organizations', 'freelance'],
    ['/freelance/organizations/organization-1', 'freelance'],
    ['/', 'jobs'],
    ['/jobs/job-1', 'jobs'],
    ['/tracker', 'jobs'],
  ] as const)('resolves %s as %s', (path, expected) => {
    expect(workspaceModeForPath(path)).toBe(expected);
  });

  it.each(['/today', '/profile', '/settings', '/login'])(
    'leaves shared route %s mode-neutral',
    (path) => {
      expect(workspaceModeForPath(path)).toBeNull();
    },
  );

  it('lets a deep link override the remembered mode', () => {
    expect(resolveWorkspaceMode('/freelance/contacts', 'jobs')).toBe('freelance');
    expect(resolveWorkspaceMode('/jobs/job-1', 'freelance')).toBe('jobs');
  });

  it('uses the remembered mode on shared routes', () => {
    expect(resolveWorkspaceMode('/today', 'freelance')).toBe('freelance');
    expect(resolveWorkspaceMode('/settings', 'jobs')).toBe('jobs');
  });

  it('defaults to job hunt and maps both landing routes', () => {
    expect(resolveWorkspaceMode('/profile', null)).toBe('jobs');
    expect(workspaceLandingPath('freelance')).toBe('/freelance');
    expect(workspaceLandingPath('jobs')).toBe('/');
  });

  it('accepts only known persisted values', () => {
    expect(isWorkspaceMode('freelance')).toBe(true);
    expect(isWorkspaceMode('jobs')).toBe(true);
    expect(isWorkspaceMode('other')).toBe(false);
    expect(isWorkspaceMode(null)).toBe(false);
  });
});

