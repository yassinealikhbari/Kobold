import { normalizeRawJob, type NormalizedJob } from './normalize.js';
import { sourceAdapters } from './sources/index.js';

export type LiveJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplace: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  url: string;
  apply_url: string | null;
  ats: string | null;
  sources: string[];
  tags: string[];
  description_html: string | null;
  description_text: string | null;
  seniority: string | null;
  german_required: boolean;
  salary_text: string | null;
  score: number;
  score_reasons: string[];
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: 'active';
  application: null;
};

export type LiveJobsResult = {
  jobs: LiveJob[];
  issues: Array<{ source: string; error: string }>;
};

export async function fetchLiveJobs(sourceNames?: string[]): Promise<LiveJobsResult> {
  const selected = sourceNames?.length
    ? sourceAdapters.filter((adapter) => sourceNames.includes(adapter.name))
    : sourceAdapters;
  const settled = await Promise.all(
    selected.map(async (adapter) => {
      try {
        return { source: adapter.name, result: await adapter.fetchJobs(), error: null as string | null };
      } catch (error) {
        return { source: adapter.name, result: null, error: errorText(error) };
      }
    }),
  );
  const jobsByKey = new Map<string, LiveJob>();
  const issues: LiveJobsResult['issues'] = [];
  const now = new Date().toISOString();

  for (const item of settled) {
    if (item.error || !item.result) {
      issues.push({ source: item.source, error: item.error ?? 'Source did not return a result' });
      continue;
    }

    const { source, result } = item;
    for (const warning of result.warnings ?? []) issues.push({ source, error: warning });
    for (const raw of result.jobs) {
      const normalized = normalizeRawJob(raw);
      if (!normalized.keep || !normalized.job) continue;
      mergeJob(jobsByKey, toLiveJob(normalized.job, source, now));
    }
  }

  return { jobs: Array.from(jobsByKey.values()), issues };
}

export async function findLiveJob(id: string): Promise<LiveJob | null> {
  const { jobs } = await fetchLiveJobs();
  return jobs.find((job) => job.id === id) ?? null;
}

function toLiveJob(job: NormalizedJob, source: string, now: string): LiveJob {
  return {
    id: job.dedupeKey,
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    workplace: job.workplace,
    url: job.url,
    apply_url: job.applyUrl ?? null,
    ats: job.ats ?? null,
    sources: [source],
    tags: job.tags,
    description_html: job.descriptionHtml ?? null,
    description_text: job.descriptionText ?? null,
    seniority: job.seniority,
    german_required: job.germanRequired,
    salary_text: job.salaryText ?? null,
    score: job.score,
    score_reasons: job.scoreReasons,
    posted_at: job.postedAt ?? null,
    first_seen_at: now,
    last_seen_at: now,
    status: 'active',
    application: null,
  };
}

function mergeJob(jobsByKey: Map<string, LiveJob>, incoming: LiveJob): void {
  const existing = jobsByKey.get(incoming.id);
  if (!existing) {
    jobsByKey.set(incoming.id, incoming);
    return;
  }

  existing.sources = Array.from(new Set([...existing.sources, ...incoming.sources]));
  existing.tags = Array.from(new Set([...existing.tags, ...incoming.tags]));
  if (!existing.description_html && incoming.description_html) existing.description_html = incoming.description_html;
  if (!existing.description_text && incoming.description_text) existing.description_text = incoming.description_text;
  if (!existing.apply_url && incoming.apply_url) existing.apply_url = incoming.apply_url;
  if (!existing.ats && incoming.ats) existing.ats = incoming.ats;
  if (!existing.location && incoming.location) existing.location = incoming.location;
  if (incoming.score > existing.score) {
    existing.score = incoming.score;
    existing.score_reasons = incoming.score_reasons;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
