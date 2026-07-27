export type WorkspaceMode = 'freelance' | 'jobs';

export const WORKSPACE_MODE_STORAGE_KEY = 'kobold.workspace-mode';

export function workspaceModeForPath(path: string): WorkspaceMode | null {
  if (path === '/freelance' || path.startsWith('/freelance/')) return 'freelance';
  if (path === '/' || path === '/tracker' || path.startsWith('/jobs/')) return 'jobs';
  return null;
}

export function resolveWorkspaceMode(
  path: string,
  rememberedMode: WorkspaceMode | null,
): WorkspaceMode {
  return workspaceModeForPath(path) ?? rememberedMode ?? 'jobs';
}

export function workspaceLandingPath(mode: WorkspaceMode): string {
  return mode === 'freelance' ? '/freelance' : '/';
}

export function isWorkspaceMode(value: string | null): value is WorkspaceMode {
  return value === 'freelance' || value === 'jobs';
}

