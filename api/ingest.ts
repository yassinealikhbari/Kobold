import type { VercelRequest, VercelResponse } from '@vercel/node';

import { constantTimeEqual, requireAuth, sendError } from './_lib/auth.js';
import { getSupabase } from './_lib/db.js';
import { normalizeRawJob, type NormalizedJob } from './_lib/normalize.js';
import { getSourceAdapter } from './_lib/sources/index.js';
import type { RawJob } from './_lib/sources/types.js';
import { sendJobNotifications, type TelegramJob } from './_lib/telegram.js';

type JobRow = {
  id: string;
  dedupe_key: string;
  title: string;
  company: string;
  location: string | null;
  workplace: string;
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
  posted_at: string | null;
  status: 'active' | 'stale' | 'expired' | 'dismissed';
};

type IngestRun = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  found: number;
  matched: number;
  inserted: number;
  error: string | null;
};

const ACTIVE_STATUSES = ['active', 'stale'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await authorizeIngest(req);

    const source = typeof req.query.source === 'string' ? req.query.source : '';
    if (!source) {
      res.status(400).json({ error: 'source query parameter is required' });
      return;
    }

    const activeRun = await findActiveRun(source);
    if (activeRun) {
      res.status(409).json({ error: 'Ingest already running', run: activeRun });
      return;
    }

    const run = await createRun(source);

    if (source === 'lifecycle') {
      const finalized = await finalizeRun(run.id, await runLifecyclePass(), null);
      res.status(200).json({ run: finalized });
      return;
    }

    const adapter = getSourceAdapter(source);
    if (!adapter) {
      const finalized = await finalizeRun(run.id, { found: 0, matched: 0, inserted: 0 }, `Unknown source: ${source}`);
      res.status(400).json({ error: `Unknown source: ${source}`, run: finalized });
      return;
    }

    let rawJobs: RawJob[] = [];
    let adapterError: string | null = null;

    try {
      rawJobs = await adapter.fetchJobs();
    } catch (error) {
      adapterError = error instanceof Error ? error.message : String(error);
    }

    const stats = { found: rawJobs.length, matched: 0, inserted: 0 };
    await ensureSettingsRow();
    const settings = await getSettings();
    const notifyJobs: TelegramJob[] = [];

    const jobsToStore: NormalizedJob[] = [];

    for (const rawJob of rawJobs) {
      const result = normalizeRawJob(rawJob);
      if (!result.keep && !result.job) continue;

      if (result.job) jobsToStore.push(result.job);

      if (result.keep) stats.matched += 1;
    }

    const insertedJobs = await upsertJobs(jobsToStore, source);
    stats.inserted = insertedJobs.length;
    if (settings.notify_enabled) {
      for (const inserted of insertedJobs) {
        if (inserted.status !== 'active' || inserted.score < settings.min_score_notify) continue;
        notifyJobs.push({
          id: inserted.id,
          title: inserted.title,
          company: inserted.company,
          location: inserted.location,
          workplace: inserted.workplace,
          score: inserted.score,
          source,
        });
      }
    }

    const telegramError = await sendJobNotifications(notifyJobs);
    const errorMessage = [adapterError, telegramError].filter(Boolean).join(' | ') || null;

    const finalized = await finalizeRun(run.id, stats, errorMessage);
    res.status(errorMessage ? 207 : 200).json({ run: finalized });
  } catch (error) {
    sendError(res, error, {
      route: '/api/ingest',
      method: req.method,
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
    });
  }
}

async function authorizeIngest(req: VercelRequest): Promise<void> {
  const header = req.headers['x-cron-secret'];
  const cronSecret = typeof header === 'string' ? header : undefined;
  const expected = process.env.CRON_SECRET;

  if (cronSecret && expected && constantTimeEqual(cronSecret, expected)) {
    return;
  }

  await requireAuth(req);
}

async function findActiveRun(source: string): Promise<IngestRun | null> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from('ingest_runs')
    .select('*')
    .eq('source', source)
    .is('finished_at', null)
    .gte('started_at', since)
    .maybeSingle();

  if (error) throw error;
  return data as IngestRun | null;
}

async function createRun(source: string): Promise<IngestRun> {
  const { data, error } = await getSupabase().from('ingest_runs').insert({ source }).select('*').single();
  if (error) throw error;
  return data as IngestRun;
}

async function finalizeRun(
  id: string,
  stats: { found: number; matched: number; inserted: number },
  errorMessage: string | null,
): Promise<IngestRun> {
  const { data, error } = await getSupabase()
    .from('ingest_runs')
    .update({
      finished_at: new Date().toISOString(),
      found: stats.found,
      matched: stats.matched,
      inserted: stats.inserted,
      error: errorMessage,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as IngestRun;
}

async function upsertJobs(jobs: NormalizedJob[], source: string): Promise<JobRow[]> {
  const uniqueJobs = Array.from(new Map(jobs.map((job) => [job.dedupeKey, job])).values());
  if (uniqueJobs.length === 0) return [];

  const existingByKey = await findJobs(uniqueJobs.map((job) => job.dedupeKey));
  const now = new Date().toISOString();
  const rows = uniqueJobs.map((job) => {
    const existing = existingByKey.get(job.dedupeKey);
    return existing ? toUpdateRow(existing, job, source, now) : toInsertRow(job, source, now);
  });

  const { data, error } = await getSupabase()
    .from('jobs')
    .upsert(rows, { onConflict: 'dedupe_key' })
    .select('*');

  if (error) throw error;

  return (data ?? []).filter((row) => !existingByKey.has((row as JobRow).dedupe_key)) as JobRow[];
}

async function findJobs(dedupeKeys: string[]): Promise<Map<string, JobRow>> {
  const jobs = new Map<string, JobRow>();

  for (let index = 0; index < dedupeKeys.length; index += 200) {
    const keys = dedupeKeys.slice(index, index + 200);
    const { data, error } = await getSupabase().from('jobs').select('*').in('dedupe_key', keys);
    if (error) throw error;

    for (const job of data ?? []) {
      const row = job as JobRow;
      jobs.set(row.dedupe_key, row);
    }
  }

  return jobs;
}

function toInsertRow(job: NormalizedJob, source: string, now: string): Record<string, unknown> {
  return {
    dedupe_key: job.dedupeKey,
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
    posted_at: job.postedAt ?? null,
    first_seen_at: now,
    last_seen_at: now,
    status: job.status,
  };
}

function toUpdateRow(existing: JobRow, job: NormalizedJob, source: string, now: string): Record<string, unknown> {
  const status = resolveStatus(existing.status, job.status);

  return {
    title: existing.title || job.title,
    company: existing.company || job.company,
    location: existing.location ?? job.location ?? null,
    workplace: existing.workplace === 'unknown' ? job.workplace : existing.workplace,
    url: existing.url || job.url,
    apply_url: existing.apply_url ?? job.applyUrl ?? null,
    ats: existing.ats ?? job.ats ?? null,
    sources: Array.from(new Set([...(existing.sources ?? []), source])),
    tags: Array.from(new Set([...(existing.tags ?? []), ...job.tags])),
    description_html: existing.description_html ?? job.descriptionHtml ?? null,
    description_text: existing.description_text ?? job.descriptionText ?? null,
    seniority: existing.seniority ?? job.seniority,
    german_required: existing.german_required || job.germanRequired,
    salary_text: existing.salary_text ?? job.salaryText ?? null,
    score: Math.max(existing.score, job.score),
    posted_at: existing.posted_at ?? job.postedAt ?? null,
    last_seen_at: now,
    status,
  };
}

function resolveStatus(
  existingStatus: JobRow['status'],
  incomingStatus: NormalizedJob['status'],
): JobRow['status'] {
  if (existingStatus === 'dismissed') return 'dismissed';
  if (incomingStatus === 'dismissed') return existingStatus;
  if (existingStatus === 'stale' || existingStatus === 'expired') return 'active';
  return existingStatus;
}

async function runLifecyclePass(): Promise<{ found: number; matched: number; inserted: number }> {
  const now = Date.now();
  const staleBefore = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredBefore = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('id,last_seen_at,status,applications(status)')
    .in('status', ACTIVE_STATUSES)
    .lt('last_seen_at', staleBefore);

  if (error) throw error;

  let updated = 0;

  for (const row of (data ?? []) as Array<{
    id: string;
    last_seen_at: string;
    status: JobRow['status'];
    applications?: Array<{ status: string }>;
  }>) {
    const hasInProgressApplication = row.applications?.some((application) => application.status !== 'saved') ?? false;
    if (hasInProgressApplication) continue;

    const nextStatus = row.last_seen_at < expiredBefore ? 'expired' : 'stale';
    if (row.status === nextStatus) continue;

    const { error: updateError } = await getSupabase().from('jobs').update({ status: nextStatus }).eq('id', row.id);
    if (updateError) throw updateError;
    updated += 1;
  }

  return { found: data?.length ?? 0, matched: updated, inserted: 0 };
}

async function ensureSettingsRow(): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('settings').select('id').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from('settings').insert({ id: 1 });
  if (insertError) throw insertError;
}

async function getSettings(): Promise<{ notify_enabled: boolean; min_score_notify: number }> {
  const { data, error } = await getSupabase()
    .from('settings')
    .select('notify_enabled,min_score_notify')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return {
    notify_enabled: Boolean(data.notify_enabled),
    min_score_notify: Number(data.min_score_notify ?? 3),
  };
}
