import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from './_lib/auth.js';
import { getSupabase } from './_lib/db.js';
import { isAuthorizedIngestCron } from './_lib/ingest-auth.js';
import { combineIngestMessages, type IngestOutcome } from './_lib/ingest-health.js';
import { discoverJobs, type DiscoveryResult, type SourceCoverage } from './_lib/job-discovery.js';
import { processJobNotifications, type JobNotificationResult } from './_lib/job-notifications.js';
import { describeServerError, errorMessage, logServerError } from './_lib/logger.js';
import { getSourceAdapter } from './_lib/sources/index.js';

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
  const isScheduledCron = req.method === 'GET' && (source === 'all' || source === 'lifecycle');
  if (req.method !== 'POST' && !isScheduledCron) {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let run: IngestRun | null = null;
  let stats: IngestStats = emptyStats();
  const startedAt = Date.now();

  try {
    await authorizeIngest(req, isScheduledCron);

    if (!source) {
      res.status(400).json({ error: 'source query parameter is required' });
      return;
    }
    if (source !== 'all' && source !== 'lifecycle' && !getSourceAdapter(source)) {
      res.status(400).json({ error: `Unknown source: ${source}` });
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

    const discovery = await discoverJobs({
      sources: source === 'all' ? undefined : [source],
      forceRefresh: true,
    });
    stats = {
      ...emptyStats(),
      found: discovery.coverage.reduce((total, item) => total + item.fetched, 0),
      matched: discovery.jobs.length,
    };

    let notification: JobNotificationResult | null = null;
    let notificationError: string | null = null;
    if (source === 'all') {
      try {
        notification = await processJobNotifications(discovery.jobs);
        notificationError = notification.error;
        stats.inserted = notification.newFingerprints;
        stats.insertedActive = notification.sent;
        stats.insertedDismissed = notification.pending;
        stats.updated = notification.baselined;
      } catch (error) {
        notificationError = notificationFailureMessage(error);
      }

      await updateCoverageHealth(discovery.coverage, new Date().toISOString());
    }

    const runMessage = combineIngestMessages([
      discoveryIssueMessage(discovery),
      notificationError,
    ]);
    const outcome = determineScanOutcome(discovery, notificationError);
    const finalized = await completeRun(run, stats, outcome, runMessage, startedAt);
    const status = outcome === 'success' || outcome === 'empty' ? 200 : outcome === 'partial' ? 207 : 502;
    res.status(status).json({
      run: finalized,
      notification,
      coverage: discovery.coverage,
      eligible: discovery.jobs.length,
    });
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

async function authorizeIngest(req: VercelRequest, allowVercelAuthorization: boolean): Promise<void> {
  const header = req.headers['x-cron-secret'];
  const cronSecret = typeof header === 'string' ? header : undefined;
  const expected = process.env.CRON_SECRET;

  const authorization = req.headers.authorization;
  if (
    isAuthorizedIngestCron({
      expectedSecret: expected,
      cronSecret,
      authorization,
      allowVercelAuthorization,
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

function determineScanOutcome(discovery: DiscoveryResult, notificationError: string | null): IngestOutcome {
  if (discovery.coverage.length > 0 && discovery.coverage.every((source) => source.status === 'failed')) {
    return 'failed';
  }
  if (
    notificationError ||
    discovery.coverage.some((source) => source.status === 'failed' || source.status === 'degraded')
  ) {
    return 'partial';
  }
  return discovery.jobs.length === 0 ? 'empty' : 'success';
}

function discoveryIssueMessage(discovery: DiscoveryResult): string | null {
  if (discovery.issues.length === 0) return null;
  const shown = discovery.issues.slice(0, 5).map((issue) => `${issue.source}: ${issue.error}`);
  if (discovery.issues.length > shown.length) shown.push(`${discovery.issues.length - shown.length} more source issues`);
  return shown.join(' | ');
}

function notificationFailureMessage(error: unknown): string {
  const message = errorMessage(error);
  if (/job_fingerprints|schema cache|PGRST205/i.test(message)) {
    return `Database migration 006_job_fingerprints.sql is required: ${message}`;
  }
  return message;
}

async function updateCoverageHealth(coverage: SourceCoverage[], finishedAt: string): Promise<void> {
  await Promise.all(
    coverage.map((source) =>
      updateSourceHealth({
        source: source.source,
        outcome: coverageOutcome(source),
        stats: {
          ...emptyStats(),
          found: source.fetched,
          matched: source.eligible,
        },
        errorMessage: combineIngestMessages([source.error, ...source.warnings]),
        durationMs: source.duration_ms,
        finishedAt,
      }),
    ),
  );
}

function coverageOutcome(source: SourceCoverage): IngestOutcome {
  if (source.status === 'failed') return 'failed';
  if (source.status === 'degraded') return 'partial';
  if (source.status === 'empty') return 'empty';
  return 'success';
}
