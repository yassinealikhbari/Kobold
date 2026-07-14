import {
  discoverJobs,
  findDiscoveredJob,
  type DiscoveredJob,
  type DiscoveryResult,
} from './job-discovery.js';

export type LiveJob = DiscoveredJob;
export type LiveJobsResult = DiscoveryResult;

export async function fetchLiveJobs(sourceNames?: string[], forceRefresh = false): Promise<LiveJobsResult> {
  return discoverJobs({ sources: sourceNames, forceRefresh });
}

export async function findLiveJob(id: string, source?: string): Promise<LiveJob | null> {
  return findDiscoveredJob({ id, source });
}
