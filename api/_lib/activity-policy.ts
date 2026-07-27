export const ACTIVITY_DELETE_WINDOW_MS = 10 * 60_000;

export function activityDeleteThreshold(now = new Date()): string {
  return new Date(now.getTime() - ACTIVITY_DELETE_WINDOW_MS).toISOString();
}

export function canDeleteActivity(createdAt: string, now = new Date()): boolean {
  return new Date(createdAt).getTime() >= now.getTime() - ACTIVITY_DELETE_WINDOW_MS;
}

