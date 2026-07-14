import type { EmploymentType, RoleFamily, Technology, Workplace } from './filters.js';
import { unratedJobFit, type JobFit } from './job-fit.js';
import { normalizeRawJob, type NormalizedJob } from './normalize.js';
import { sourceAdapters } from './sources/index.js';
import type { SourceAdapter, SourceFetchResult } from './sources/types.js';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;
const DEFAULT_SOURCE_TIMEOUT_MS = 15_000;

export type SourceListing = {
  source: string;
  url: string;
  apply_url: string | null;
};

export type DiscoveredJob = {
  id: string;
  title: string;
  company: string;
  role_family: RoleFamily | null;
  location: string | null;
  workplace: Workplace;
  url: string;
  apply_url: string | null;
  ats: string | null;
  sources: string[];
  source_listings: SourceListing[];
  tags: string[];
  technologies: Technology[];
  employment_types: EmploymentType[];
  description_html: string | null;
  description_text: string | null;
  seniority: string | null;
  german_required: boolean;
  salary_text: string | null;
  score: number;
  score_reasons: string[];
  eligibility_warnings: string[];
  fit: JobFit;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: 'active';
  application: null;
};

export type SourceCoverage = {
  source: string;
  status: 'ok' | 'degraded' | 'empty' | 'failed';
  fetched: number;
  parsed: number;
  eligible: number;
  returned: number;
  duplicates: number;
  excluded: Record<string, number>;
  duration_ms: number;
  cache_hit: boolean;
  warnings: string[];
  error?: string;
};

export type DiscoveryIssue = {
  source: string;
  error: string;
  severity: 'warning' | 'error';
};

export type DiscoveryResult = {
  jobs: DiscoveredJob[];
  coverage: SourceCoverage[];
  issues: DiscoveryIssue[];
  fetched_at: string;
  cache: {
    hit: boolean;
    expires_at: string | null;
  };
};

export type DiscoverJobsOptions = {
  sources?: string[];
  forceRefresh?: boolean;
  now?: Date;
};

export type FindDiscoveredJobOptions = {
  id: string;
  source?: string;
};

export type JobDiscovery = {
  discoverJobs(options?: DiscoverJobsOptions): Promise<DiscoveryResult>;
  findDiscoveredJob(options: FindDiscoveredJobOptions): Promise<DiscoveredJob | null>;
};

type SourceSnapshot = {
  result?: SourceFetchResult;
  error?: string;
  durationMs: number;
  fetchedAtMs: number;
  expiresAtMs: number;
};

type DiscoveryFactoryOptions = {
  adapters: SourceAdapter[];
  cacheTtlMs?: number;
  sourceTimeoutMs?: number;
  clock?: () => number;
};

export function createJobDiscovery(options: DiscoveryFactoryOptions): JobDiscovery {
  const adapters = [...options.adapters];
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const sourceTimeoutMs = options.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  const clock = options.clock ?? Date.now;
  const snapshots = new Map<string, SourceSnapshot>();

  async function discoverJobs(discoverOptions: DiscoverJobsOptions = {}): Promise<DiscoveryResult> {
    const discoveryTime = discoverOptions.now ?? new Date(clock());
    const requestedSources = discoverOptions.sources?.length
      ? Array.from(new Set(discoverOptions.sources))
      : adapters.map((adapter) => adapter.name);
    const adapterByName = new Map(adapters.map((adapter) => [adapter.name, adapter]));
    const jobsById = new Map<string, DiscoveredJob>();
    const identityIndex = new Map<string, string>();
    const coverage: SourceCoverage[] = [];
    const issues: DiscoveryIssue[] = [];
    const sourceResults = await Promise.all(
      requestedSources.map(async (source) => {
        const adapter = adapterByName.get(source);
        if (!adapter) return { source, adapter: null, snapshot: null, cacheHit: false };
        const fetched = await fetchSnapshot(adapter, Boolean(discoverOptions.forceRefresh));
        return { source, adapter, snapshot: fetched.snapshot, cacheHit: fetched.cacheHit };
      }),
    );

    for (const sourceResult of sourceResults) {
      const { source, snapshot, cacheHit } = sourceResult;
      if (!snapshot) {
        const error = `Unknown source: ${source}`;
        coverage.push(emptyCoverage(source, error));
        issues.push({ source, error, severity: 'error' });
        continue;
      }

      const sourceCoverage: SourceCoverage = {
        source,
        status: snapshot.error ? 'failed' : snapshot.result?.jobs.length ? 'ok' : 'empty',
        fetched: snapshot.result?.jobs.length ?? 0,
        parsed: 0,
        eligible: 0,
        returned: 0,
        duplicates: 0,
        excluded: {},
        duration_ms: snapshot.durationMs,
        cache_hit: cacheHit,
        warnings: snapshot.result?.warnings ?? [],
        ...(snapshot.error ? { error: snapshot.error } : {}),
      };
      coverage.push(sourceCoverage);

      if (snapshot.error || !snapshot.result) {
        issues.push({ source, error: snapshot.error ?? 'Source did not return a result', severity: 'error' });
        continue;
      }

      if (sourceCoverage.warnings.length > 0) sourceCoverage.status = 'degraded';
      for (const warning of sourceCoverage.warnings) {
        issues.push({ source, error: warning, severity: 'warning' });
      }

      for (const raw of snapshot.result.jobs) {
        const normalized = normalizeRawJob(raw, { source, now: discoveryTime, maxAgeDays: 14 });
        if (normalized.job) sourceCoverage.parsed += 1;
        if (!normalized.keep) {
          increment(sourceCoverage.excluded, 'reason' in normalized ? normalized.reason : 'ineligible');
          continue;
        }

        sourceCoverage.eligible += 1;
        const incoming = toDiscoveredJob(normalized.job, discoveryTime.toISOString());
        const existingId = normalized.job.mergeKeys.map((key) => identityIndex.get(key)).find(Boolean);
        if (existingId) {
          const existing = jobsById.get(existingId);
          if (existing) mergeJob(existing, incoming);
          sourceCoverage.duplicates += 1;
          for (const key of normalized.job.mergeKeys) identityIndex.set(key, existingId);
          continue;
        }

        jobsById.set(incoming.id, incoming);
        for (const key of normalized.job.mergeKeys) identityIndex.set(key, incoming.id);
      }
    }

    const jobs = Array.from(jobsById.values()).sort(compareNewestFirst);
    for (const item of coverage) {
      item.returned = jobs.filter((job) => job.sources.includes(item.source)).length;
    }

    const snapshotsUsed = sourceResults.flatMap((result) => (result.snapshot ? [result.snapshot] : []));
    const expiresAtMs = snapshotsUsed.length > 0 ? Math.min(...snapshotsUsed.map((snapshot) => snapshot.expiresAtMs)) : null;
    return {
      jobs,
      coverage,
      issues,
      fetched_at: discoveryTime.toISOString(),
      cache: {
        hit: sourceResults.length > 0 && sourceResults.every((result) => result.cacheHit),
        expires_at: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
      },
    };
  }

  async function findDiscoveredJob(findOptions: FindDiscoveredJobOptions): Promise<DiscoveredJob | null> {
    const sources = findOptions.source ? [findOptions.source] : undefined;
    const first = await discoverJobs({ sources });
    const cached = first.jobs.find((job) => job.id === findOptions.id);
    if (cached) return cached;
    if (!first.cache.hit) return null;

    const refreshed = await discoverJobs({ sources, forceRefresh: true });
    return refreshed.jobs.find((job) => job.id === findOptions.id) ?? null;
  }

  async function fetchSnapshot(
    adapter: SourceAdapter,
    forceRefresh: boolean,
  ): Promise<{ snapshot: SourceSnapshot; cacheHit: boolean }> {
    const nowMs = clock();
    const cached = snapshots.get(adapter.name);
    if (!forceRefresh && cached && cached.expiresAtMs > nowMs) return { snapshot: cached, cacheHit: true };

    const startedAt = clock();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Source timed out after ${sourceTimeoutMs}ms`)), sourceTimeoutMs);
      });
      const result = await Promise.race([adapter.fetchJobs(), timeout]);
      const fetchedAtMs = clock();
      const snapshot: SourceSnapshot = {
        result,
        durationMs: Math.max(0, fetchedAtMs - startedAt),
        fetchedAtMs,
        expiresAtMs: fetchedAtMs + cacheTtlMs,
      };
      snapshots.set(adapter.name, snapshot);
      return { snapshot, cacheHit: false };
    } catch (error) {
      const fetchedAtMs = clock();
      const snapshot: SourceSnapshot = {
        error: errorText(error),
        durationMs: Math.max(0, fetchedAtMs - startedAt),
        fetchedAtMs,
        expiresAtMs: fetchedAtMs + cacheTtlMs,
      };
      snapshots.set(adapter.name, snapshot);
      return { snapshot, cacheHit: false };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { discoverJobs, findDiscoveredJob };
}

const productionDiscovery = createJobDiscovery({ adapters: sourceAdapters });

export const discoverJobs = productionDiscovery.discoverJobs;
export const findDiscoveredJob = productionDiscovery.findDiscoveredJob;

function toDiscoveredJob(job: NormalizedJob, now: string): DiscoveredJob {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    role_family: job.roleFamily,
    location: job.location ?? null,
    workplace: job.workplace,
    url: job.url,
    apply_url: job.applyUrl ?? null,
    ats: job.ats ?? null,
    sources: [job.source],
    source_listings: [{ source: job.source, url: job.url, apply_url: job.applyUrl ?? null }],
    tags: job.tags,
    technologies: job.technologies,
    employment_types: job.employmentTypes,
    description_html: job.descriptionHtml ?? null,
    description_text: job.descriptionText ?? null,
    seniority: job.seniority,
    german_required: job.germanRequired,
    salary_text: job.salaryText ?? null,
    score: job.score,
    score_reasons: job.scoreReasons,
    eligibility_warnings: job.eligibilityWarnings,
    fit: unratedJobFit(),
    posted_at: job.postedAt ?? null,
    first_seen_at: now,
    last_seen_at: now,
    status: 'active',
    application: null,
  };
}

function mergeJob(existing: DiscoveredJob, incoming: DiscoveredJob): void {
  existing.sources = unique([...existing.sources, ...incoming.sources]);
  existing.source_listings = uniqueListings([...existing.source_listings, ...incoming.source_listings]);
  existing.tags = unique([...existing.tags, ...incoming.tags]);
  existing.technologies = unique([...existing.technologies, ...incoming.technologies]);
  existing.employment_types = unique([...existing.employment_types, ...incoming.employment_types]);
  existing.eligibility_warnings = unique([...existing.eligibility_warnings, ...incoming.eligibility_warnings]);
  existing.score_reasons = unique([...existing.score_reasons, ...incoming.score_reasons]);

  if (isUnknownCompany(existing.company) && !isUnknownCompany(incoming.company)) existing.company = incoming.company;
  if (!existing.location && incoming.location) existing.location = incoming.location;
  if (!existing.apply_url && incoming.apply_url) existing.apply_url = incoming.apply_url;
  if (!existing.ats && incoming.ats) existing.ats = incoming.ats;
  if (!existing.salary_text && incoming.salary_text) existing.salary_text = incoming.salary_text;
  if ((incoming.description_html?.length ?? 0) > (existing.description_html?.length ?? 0)) {
    existing.description_html = incoming.description_html;
  }
  if ((incoming.description_text?.length ?? 0) > (existing.description_text?.length ?? 0)) {
    existing.description_text = incoming.description_text;
  }
  if (incoming.score > existing.score) existing.score = incoming.score;
  if ((incoming.posted_at ?? '') > (existing.posted_at ?? '')) existing.posted_at = incoming.posted_at;
}

function compareNewestFirst(left: DiscoveredJob, right: DiscoveredJob): number {
  const leftTime = left.posted_at ? Date.parse(left.posted_at) : Number.NEGATIVE_INFINITY;
  const rightTime = right.posted_at ? Date.parse(right.posted_at) : Number.NEGATIVE_INFINITY;
  return rightTime - leftTime || left.id.localeCompare(right.id);
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function uniqueListings(listings: SourceListing[]): SourceListing[] {
  const byKey = new Map<string, SourceListing>();
  for (const listing of listings) byKey.set(`${listing.source}:${listing.url}`, listing);
  return Array.from(byKey.values());
}

function isUnknownCompany(company: string): boolean {
  return !company.trim() || company === '(see listing)';
}

function emptyCoverage(source: string, error: string): SourceCoverage {
  return {
    source,
    status: 'failed',
    fetched: 0,
    parsed: 0,
    eligible: 0,
    returned: 0,
    duplicates: 0,
    excluded: {},
    duration_ms: 0,
    cache_hit: false,
    warnings: [],
    error,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
