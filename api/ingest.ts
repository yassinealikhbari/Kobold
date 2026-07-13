import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from './_lib/auth.js';
import { getSupabase } from './_lib/db.js';
import { isAuthorizedIngestCron } from './_lib/ingest-auth.js';
import { combineIngestMessages, determineIngestOutcome, type IngestOutcome } from './_lib/ingest-health.js';
import { describeServerError, errorMessage, logServerError } from './_lib/logger.js';
import { normalizeRawJob, type NormalizedJob } from './_lib/normalize.js';
import { getSourceAdapter } from './_lib/sources/index.js';
import type { RawJob } from './_lib/sources/types.js';

type IngestRun = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  found: number;
  matched: number;
  inserted: number;
  error: string | null;
  outcome: IngestOutcome;
  duration_ms: number | null;
};

type IngestStats = {
  found: number;
  matched: number;
  inserted: number;
  insertedActive: number;
  insertedDismissed: number;
  updated: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const isLifecycleCron = req.method === 'GET' && source === 'lifecycle';
  if (req.method !== 'POST' && !isLifecycleCron) {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let run: IngestRun | null = null;
  let stats: IngestStats = emptyStats();
  const startedAt = Date.now();

  try {
    await authorizeIngest(req, isLifecycleCron);

    if (!source) {
      res.status(400).json({ error: 'source query parameter is required' });
      return;
    }

    const activeRun = await findActiveRun(source);
    if (activeRun) {
      res.status(409).json({ error: 'Ingest already running', run: activeRun });
      return;
    }

    run = await createRun(source);

    if (source === 'lifecycle') {
      // Listings are live-only, so lifecycle work no longer mutates historical job rows.
      const finalized = await completeRun(run, stats, 'success', null, startedAt);
      res.status(200).json({ run: finalized });
      return;
    }

    const adapter = getSourceAdapter(source);
    if (!adapter) {
      const finalized = await completeRun(run, stats, 'failed', `Unknown source: ${source}`, startedAt);
      res.status(400).json({ error: `Unknown source: ${source}`, run: finalized });
      return;
    }

    let rawJobs: RawJob[] = [];
    let adapterError: string | null = null;
    let adapterWarnings: string[] = [];

    try {
      const result = await adapter.fetchJobs();
      rawJobs = result.jobs;
      adapterWarnings = result.warnings ?? [];
    } catch (error) {
      adapterError = error instanceof Error ? error.message : String(error);
    }

    stats = { ...emptyStats(), found: rawJobs.length };
    const matchingJobs: NormalizedJob[] = [];

    for (const rawJob of rawJobs) {
      const result = normalizeRawJob(rawJob);
      if (!result.keep && !result.job) continue;

      if (result.keep && result.job) matchingJobs.push(result.job);

      if (result.keep) stats.matched += 1;
    }

    // This endpoint records source health only. Job listings are fetched directly by /api/jobs.
    stats.inserted = 0;
    // Without persisted source fingerprints, a cron run cannot distinguish new
    // listings from listings seen previously. Do not resend the entire feed.
    const errorMessage = combineIngestMessages([adapterError, ...adapterWarnings]);
    const outcome = determineIngestOutcome({
      found: stats.found,
      adapterError,
      warnings: adapterWarnings,
      notificationError: null,
    });

    const finalized = await completeRun(run, stats, outcome, errorMessage, startedAt);
    res.status(outcome === 'success' || outcome === 'empty' ? 200 : 207).json({ run: finalized });
  } catch (error) {
    if (run) {
      const message = errorMessage(error);
      try {
        await completeRun(run, stats, 'failed', message, startedAt);
      } catch (finalizeError) {
        logServerError(finalizeError, { route: '/api/ingest/finalize', method: req.method, source });
      }
    }

    sendError(res, error, {
      route: '/api/ingest',
      method: req.method,
      source: source || undefined,
    });
  }
}

async function authorizeIngest(req: VercelRequest, isLifecycleCron: boolean): Promise<void> {
  const header = req.headers['x-cron-secret'];
  const cronSecret = typeof header === 'string' ? header : undefined;
  const expected = process.env.CRON_SECRET;

  const authorization = req.headers.authorization;
  if (
    isAuthorizedIngestCron({
      expectedSecret: expected,
      cronSecret,
      authorization,
      allowVercelAuthorization: isLifecycleCron,
    })
  ) {
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

async function completeRun(
  run: IngestRun,
  stats: IngestStats,
  outcome: IngestOutcome,
  errorMessage: string | null,
  startedAt: number,
): Promise<IngestRun> {
  const finishedAt = new Date();
  const durationMs = Math.max(0, Date.now() - startedAt);
  const supabase = getSupabase();
  const baseUpdate = {
    finished_at: finishedAt.toISOString(),
    found: stats.found,
    matched: stats.matched,
    inserted: stats.inserted,
    error: errorMessage,
  };
  let finalized: IngestRun;
  let usedLegacyColumns = false;

  const { data, error } = await supabase
    .from('ingest_runs')
    .update({
      ...baseUpdate,
      inserted_active: stats.insertedActive,
      inserted_dismissed: stats.insertedDismissed,
      updated: stats.updated,
      outcome,
      duration_ms: durationMs,
    })
    .eq('id', run.id)
    .select('*')
    .single();

  if (error && !isMissingRunColumnError(error)) throw error;
  if (error) {
    usedLegacyColumns = true;
    const { data: legacyData, error: legacyError } = await supabase
      .from('ingest_runs')
      .update(baseUpdate)
      .eq('id', run.id)
      .select('*')
      .single();
    if (legacyError) throw legacyError;
    finalized = legacyData as IngestRun;
  } else {
    finalized = data as IngestRun;
  }

  if (run.source !== 'lifecycle' && !usedLegacyColumns) {
    await updateSourceHealth({
      source: run.source,
      outcome,
      stats,
      errorMessage,
      durationMs,
      finishedAt: finishedAt.toISOString(),
    });
  }
  return finalized;
}

function isMissingRunColumnError(error: unknown): boolean {
  const details = describeServerError(error);
  return details.code === '42703' || details.code === 'PGRST204';
}

async function updateSourceHealth(input: {
  source: string;
  outcome: IngestOutcome;
  stats: IngestStats;
  errorMessage: string | null;
  durationMs: number;
  finishedAt: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { data: existing, error: readError } = await supabase
    .from('source_health')
    .select('last_success_at,last_nonempty_at,consecutive_failures')
    .eq('source', input.source)
    .maybeSingle();
  if (readError) throw readError;

  const isSuccessful = input.outcome === 'success' || input.outcome === 'empty';
  const consecutiveFailures = input.outcome === 'failed' ? Number(existing?.consecutive_failures ?? 0) + 1 : 0;
  const { error } = await supabase.from('source_health').upsert(
    {
      source: input.source,
      last_run_at: input.finishedAt,
      last_success_at: isSuccessful ? input.finishedAt : existing?.last_success_at ?? null,
      last_nonempty_at: input.stats.found > 0 ? input.finishedAt : existing?.last_nonempty_at ?? null,
      last_outcome: input.outcome,
      last_found: input.stats.found,
      last_matched: input.stats.matched,
      last_inserted: input.stats.inserted,
      last_duration_ms: input.durationMs,
      last_error: input.errorMessage,
      consecutive_failures: consecutiveFailures,
      updated_at: input.finishedAt,
    },
    { onConflict: 'source' },
  );
  if (error) throw error;
}

function emptyStats(): IngestStats {
  return { found: 0, matched: 0, inserted: 0, insertedActive: 0, insertedDismissed: 0, updated: 0 };
}
