import { randomUUID } from 'node:crypto';

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  calculateCrmMetrics,
  type MetricActivity,
  type MetricOpportunity,
  type MetricOrganization,
} from '../_lib/crm-metrics.js';
import { contactPayload, isUuid, organizationPayload, opportunityPayload, queryBoolean } from '../_lib/crm-validation.js';
import { parseCsv, toCsv } from '../_lib/csv.js';
import { getSupabase } from '../_lib/db.js';
import { isAuthorizedIngestCron } from '../_lib/ingest-auth.js';
import { combineIngestMessages, type IngestOutcome } from '../_lib/ingest-health.js';
import { discoverJobs, type DiscoveryResult, type SourceCoverage } from '../_lib/job-discovery.js';
import { processJobNotifications, type JobNotificationResult } from '../_lib/job-notifications.js';
import {
  buildDedupeIndex,
  buildOrganizationCreatePayload,
  buildOrganizationUpdatePayload,
  normalizeDomain,
  parseLeadRow,
  planContactForRow,
  planOpportunityForRow,
  resolveOrganizationMatch,
  type ContactLite,
  type DedupeIndex,
  type OpportunityLite,
  type OrganizationLite,
} from '../_lib/lead-import.js';
import type { LiveJob } from '../_lib/live-jobs.js';
import { describeServerError, errorMessage, logServerError } from '../_lib/logger.js';
import { getOrCreateProfile, normalizeProfile, profileUpdatePayload } from '../_lib/profile.js';
import { auditWebsite } from '../_lib/site-audit.js';
import { getSourceAdapter } from '../_lib/sources/index.js';
import { berlinDate, buildTaskDigest, type DigestTask } from '../_lib/task-digest.js';
import { endOfDayUtc } from '../_lib/task-scopes.js';
import { isTelegramConfigured, sendTelegramText } from '../_lib/telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = typeof req.query.resource === 'string' ? req.query.resource : '';
  switch (resource) {
    case 'audit':
      return handleAudit(req, res);
    case 'export':
      return handleExport(req, res);
    case 'metrics':
      return handleMetrics(req, res);
    case 'settings':
      return handleSettings(req, res);
    case 'task-digest':
      return handleTaskDigest(req, res);
    case 'cover-letter':
      return handleCoverLetter(req, res);
    case 'health':
      return handleHealth(req, res);
    case 'profile':
      return handleProfile(req, res);
    case 'ingest':
      return handleIngest(req, res);
    case 'leads-import':
      return handleLeadsImport(req, res);
    default:
      res.status(404).json({ error: 'Not found' });
  }
}

// ==================== audit ====================

async function handleAudit(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const organizationId =
        typeof req.query.organization_id === 'string' ? req.query.organization_id : '';
      if (!isUuid(organizationId)) throw new HttpError(400, 'A valid organization_id is required');
      const { data, error } = await db
        .from('site_audits')
        .select('*')
        .eq('organization_id', organizationId)
        .order('audited_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.status(200).json({ audits: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const url = typeof req.body?.url === 'string' ? req.body.url : '';
      const organizationId =
        typeof req.body?.organization_id === 'string' ? req.body.organization_id : null;
      if (organizationId && !isUuid(organizationId)) {
        throw new HttpError(400, 'A valid organization_id is required');
      }
      const snapshot = await auditWebsite(url);
      const { data, error } = await db
        .from('site_audits')
        .insert({ organization_id: organizationId, ...snapshot })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201).json({ audit: data });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/audit', method: req.method });
  }
}

// ==================== export ====================

const EXPORTS = {
  organizations: [
    'id', 'name', 'website', 'industry', 'district', 'postcode', 'country', 'language',
    'origin', 'status', 'notes', 'address', 'lead_score', 'lead_score_reason',
    'missing_function', 'staleness_evidence', 'hook_verified', 'source_place_id',
    'archived_at', 'created_at', 'updated_at',
  ],
  contacts: [
    'id', 'organization_id', 'full_name', 'role', 'email', 'phone', 'instagram',
    'linkedin', 'language', 'is_primary', 'notes', 'archived_at', 'created_at', 'updated_at',
  ],
  opportunities: [
    'id', 'organization_id', 'title', 'stage', 'value_cents', 'currency', 'confidence',
    'expected_close', 'lost_reason', 'archived_at', 'stage_changed_at', 'created_at', 'updated_at',
  ],
  activities: [
    'id', 'subject_type', 'subject_id', 'subject_label', 'kind', 'body', 'metadata',
    'occurred_at', 'created_at',
  ],
} as const;

async function handleExport(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const entity = typeof req.query.entity === 'string' ? req.query.entity : '';
    if (!(entity in EXPORTS)) throw new HttpError(400, 'Invalid export entity');
    const columns = EXPORTS[entity as keyof typeof EXPORTS];
    const { data, error } = await getSupabase()
      .from(entity)
      .select(columns.join(','))
      .order('created_at', { ascending: true })
      .limit(50000);
    if (error) throw error;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kobold-${entity}.csv"`);
    res.status(200).send(toCsv((data ?? []) as unknown as Record<string, unknown>[], [...columns]));
  } catch (error) {
    sendError(res, error, { route: '/api/export', method: req.method });
  }
}

// ==================== metrics ====================

async function handleMetrics(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const db = getSupabase();
    const [organizations, opportunities, activities] = await Promise.all([
      db.from('organizations').select('created_at'),
      db
        .from('opportunities')
        .select('id,stage,value_cents,currency,lost_reason')
        .is('archived_at', null),
      db
        .from('activities')
        .select('subject_id,kind,metadata,occurred_at')
        .eq('subject_type', 'opportunity')
        .order('occurred_at', { ascending: true })
        .limit(10000),
    ]);
    if (organizations.error) throw organizations.error;
    if (opportunities.error) throw opportunities.error;
    if (activities.error) throw activities.error;
    res.status(200).json({
      metrics: calculateCrmMetrics(
        (organizations.data ?? []) as MetricOrganization[],
        (opportunities.data ?? []) as MetricOpportunity[],
        (activities.data ?? []) as MetricActivity[],
      ),
    });
  } catch (error) {
    sendError(res, error, { route: '/api/metrics', method: req.method });
  }
}

// ==================== settings ====================

async function handleSettings(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      const [settings, runs, sourceHealth, notificationStatus] = await Promise.all([
        getSettings(),
        getRuns(),
        getSourceHealth(),
        getNotificationStatus(),
      ]);
      res.status(200).json({
        settings,
        runs,
        sourceHealth,
        notificationStatus,
        telegramConfigured: isTelegramConfigured(),
      });
      return;
    }

    if (req.method === 'PUT') {
      const notifyEnabled =
        typeof req.body?.notify_enabled === 'boolean' ? req.body.notify_enabled : undefined;
      const minScoreNotify =
        typeof req.body?.min_score_notify === 'number' ? req.body.min_score_notify : undefined;
      const taskNotifyEnabled =
        typeof req.body?.task_notify_enabled === 'boolean'
          ? req.body.task_notify_enabled
          : undefined;

      if (notifyEnabled && !isTelegramConfigured()) {
        throw new HttpError(400, 'Configure Telegram credentials before enabling notifications');
      }
      if (notifyEnabled && (await getNotificationStatus()).migrationRequired) {
        throw new HttpError(409, 'Apply migration 006_job_fingerprints.sql before enabling notifications');
      }
      if (taskNotifyEnabled && !isTelegramConfigured()) {
        throw new HttpError(400, 'Configure Telegram credentials before enabling task notifications');
      }

      const payload: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (notifyEnabled !== undefined) payload.notify_enabled = notifyEnabled;
      if (minScoreNotify !== undefined) payload.min_score_notify = minScoreNotify;
      if (taskNotifyEnabled !== undefined) payload.task_notify_enabled = taskNotifyEnabled;

      const { data, error } = await getSupabase()
        .from('settings')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) throw error;
      res.status(200).json({ settings: data });
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/settings', method: req.method });
  }
}

async function getSettings() {
  const { data, error } = await getSupabase().from('settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await getSupabase()
    .from('settings')
    .insert({ id: 1 })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return inserted;
}

async function getRuns() {
  const { data, error } = await getSupabase()
    .from('ingest_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

async function getSourceHealth() {
  const { data, error } = await getSupabase().from('source_health').select('*').order('source');
  if (error) throw error;
  return data ?? [];
}

async function getNotificationStatus() {
  const trackedResult = await getSupabase()
    .from('job_fingerprints')
    .select('fingerprint', { count: 'exact', head: true });

  if (trackedResult.error) {
    if (isMissingFingerprintTable(trackedResult.error)) {
      return { tracked: 0, pending: 0, lastSentAt: null, baselineAt: null, migrationRequired: true };
    }
    throw trackedResult.error;
  }

  const [pendingResult, lastSentResult, baselineResult] = await Promise.all([
    getSupabase()
      .from('job_fingerprints')
      .select('fingerprint', { count: 'exact', head: true })
      .is('notified_at', null),
    getSupabase()
      .from('job_fingerprints')
      .select('notified_at')
      .not('notification_attempted_at', 'is', null)
      .not('notified_at', 'is', null)
      .order('notified_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSupabase()
      .from('job_fingerprints')
      .select('notified_at')
      .is('notification_attempted_at', null)
      .not('notified_at', 'is', null)
      .order('notified_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (pendingResult.error) throw pendingResult.error;
  if (lastSentResult.error) throw lastSentResult.error;
  if (baselineResult.error) throw baselineResult.error;
  return {
    tracked: trackedResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    lastSentAt: lastSentResult.data?.notified_at ?? null,
    baselineAt: baselineResult.data?.notified_at ?? null,
    migrationRequired: false,
  };
}

function isMissingFingerprintTable(error: unknown): boolean {
  const details = describeServerError(error);
  return details.code === '42P01' || details.code === 'PGRST205' || /job_fingerprints/i.test(details.message);
}

// ==================== task-digest ====================

async function handleTaskDigest(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    await authorizeTaskDigest(req);
    const db = getSupabase();
    const { data: settings, error: settingsError } = await db
      .from('settings')
      .select('task_notify_enabled,task_digest_sent_on')
      .eq('id', 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (settings?.task_notify_enabled !== true) {
      res.status(200).json({ disabled: true, sent: 0 });
      return;
    }

    const today = berlinDate();
    if (settings.task_digest_sent_on === today) {
      res.status(200).json({ duplicate: true, sent: 0 });
      return;
    }

    const { data, error } = await db
      .from('tasks')
      .select('title,subject_label,mode,due_at')
      .is('done_at', null)
      .not('due_at', 'is', null)
      .lte('due_at', endOfDayUtc(new Date()).toISOString())
      .order('due_at', { ascending: true });
    if (error) throw error;
    const tasks = (data ?? []) as DigestTask[];
    if (!tasks.length) {
      res.status(200).json({ sent: 0 });
      return;
    }
    const sendErrorMessage = await sendTelegramText(buildTaskDigest(tasks));
    if (sendErrorMessage) throw new HttpError(502, sendErrorMessage);
    const { error: updateError } = await db
      .from('settings')
      .update({ task_digest_sent_on: today, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (updateError) throw updateError;
    res.status(200).json({ sent: tasks.length });
  } catch (error) {
    sendError(res, error, { route: '/api/task-digest', method: req.method });
  }
}

async function authorizeTaskDigest(req: VercelRequest) {
  const header = req.headers['x-cron-secret'];
  const cronSecret = typeof header === 'string' ? header : undefined;
  if (
    isAuthorizedIngestCron({
      expectedSecret: process.env.CRON_SECRET,
      cronSecret,
      authorization: req.headers.authorization,
      allowVercelAuthorization: req.method === 'GET',
    })
  ) {
    return;
  }
  await requireAuth(req);
}

// ==================== cover-letter ====================

const MAX_INSTRUCTIONS_LENGTH = 1_000;

async function handleCoverLetter(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await requireAuth(req);
    const job = readJob(req.body?.job);
    const profile = await getOrCreateProfile();
    if (!profile.summary) throw new HttpError(400, 'Complete your profile summary first');
    const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      throw new HttpError(400, `Extra instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer`);
    }
    res.status(200).json({ letter: await generateCoverLetter({ profile, job, instructions }) });
  } catch (error) {
    sendError(res, error, { route: '/api/cover-letter', method: req.method });
  }
}

function readJob(value: unknown): LiveJob {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'A live job snapshot is required');
  const job = value as Partial<LiveJob>;
  if (!job.id || !job.title || !job.company || !job.url) throw new HttpError(400, 'Job snapshot is incomplete');
  return job as LiveJob;
}

async function generateCoverLetter(input: {
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>;
  job: LiveJob;
  instructions: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(502, 'OPENAI_API_KEY is not configured');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 450,
      messages: [
        { role: 'system', content: 'Write a concise, specific 180-250 word software engineering cover letter. Be professional and warm, avoid cliches and fabricated experience. Output plain text only.' },
        { role: 'user', content: buildPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new HttpError(502, 'OpenAI cover letter generation failed');
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const letter = data.choices?.[0]?.message?.content?.trim();
  if (!letter) throw new HttpError(502, 'OpenAI returned an empty cover letter');
  return letter;
}

function buildPrompt(input: { profile: Awaited<ReturnType<typeof getOrCreateProfile>>; job: LiveJob; instructions: string }): string {
  const history = input.profile.work_history.map((work) => `- ${work.role} at ${work.company}: ${work.highlights.filter(Boolean).join('; ')}`).join('\n');
  return [
    `CANDIDATE PROFILE:\n${input.profile.summary}`,
    `Skills: ${input.profile.skills.join(', ')}`,
    `Work history:\n${history}`,
    `JOB: ${input.job.title} at ${input.job.company}\n${(input.job.description_text ?? '').slice(0, 6000)}`,
    input.instructions ? `Extra instructions: ${input.instructions}` : '',
  ].filter(Boolean).join('\n\n');
}

// ==================== health ====================

function handleHealth(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true });
}

// ==================== profile ====================

async function handleProfile(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      res.status(200).json({ profile: await getOrCreateProfile() });
      return;
    }

    if (req.method === 'PUT') {
      const payload = profileUpdatePayload(req.body ?? {});
      const { data, error } = await getSupabase()
        .from('profile')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) throw error;
      res.status(200).json({ profile: normalizeProfile(data) });
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/profile', method: req.method });
  }
}

// ==================== ingest ====================

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

async function handleIngest(req: VercelRequest, res: VercelResponse) {
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
    const eligibleJobs = discovery.jobs.filter((job) => job.profile_eligible);
    stats = {
      ...emptyStats(),
      found: discovery.coverage.reduce((total, item) => total + item.fetched, 0),
      matched: eligibleJobs.length,
    };

    let notification: JobNotificationResult | null = null;
    let notificationError: string | null = null;
    if (source === 'all') {
      try {
        notification = await processJobNotifications(eligibleJobs);
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
      eligible: eligibleJobs.length,
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

// ==================== leads-import ====================

const MAX_CSV_LENGTH = 2_000_000;

type RowResult = {
  row_number: number;
  business: string;
  place_id: string | null;
  organization_action: 'create' | 'update' | 'skip';
  organization_match: 'place_id' | 'domain' | 'phone' | 'none';
  organization_id?: string;
  contact_action: 'create' | 'update' | 'none';
  opportunity_action: 'create' | 'update' | 'skip';
  warnings: string[];
};

type RowError = { row_number: number; error: string };

async function handleLeadsImport(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    await requireAuth(req);
    const db = getSupabase();

    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) throw new HttpError(400, 'A csv field with CSV text is required');
    if (csv.length > MAX_CSV_LENGTH) throw new HttpError(400, 'CSV is too large');
    const dryRun = queryBoolean(req.query.dry_run, 'dry_run') ?? false;

    const parsedRows = parseCsv(csv);
    const [organizations, contacts, opportunities] = await Promise.all([
      fetchLeadOrganizations(db),
      fetchLeadActiveContacts(db),
      fetchLeadOpportunities(db),
    ]);
    const index = buildDedupeIndex(organizations, contacts);
    const contactsByOrg = groupContactsByOrganization(contacts);
    const opportunitiesByOrg = groupOpportunitiesByOrganization(opportunities);

    const results: RowResult[] = [];
    const rowErrors: RowError[] = [];
    const totals = {
      rows_parsed: parsedRows.length,
      organizations_created: 0,
      organizations_updated: 0,
      organizations_skipped: 0,
      contacts_created: 0,
      contacts_updated: 0,
      contacts_skipped: 0,
      opportunities_created: 0,
      opportunities_updated: 0,
    };

    for (const [offset, raw] of parsedRows.entries()) {
      const rowNumber = offset + 2;
      try {
        const parsed = parseLeadRow(raw);
        if ('error' in parsed) {
          rowErrors.push({ row_number: rowNumber, error: parsed.error });
          continue;
        }
        const row = parsed.row;
        const match = resolveOrganizationMatch(row, index);
        const warnings = match.warning ? [match.warning] : [];

        if (match.organization?.archived_at) {
          totals.organizations_skipped += 1;
          results.push({
            row_number: rowNumber,
            business: row.business,
            place_id: row.placeId,
            organization_action: 'skip',
            organization_match: match.matchedBy,
            organization_id: match.organization.id,
            contact_action: 'none',
            opportunity_action: 'skip',
            warnings: [...warnings, 'Matched an archived organization; left untouched.'],
          });
          continue;
        }

        let organizationId: string;
        let organizationAction: RowResult['organization_action'];

        if (!match.organization) {
          const validated = organizationPayload(buildOrganizationCreatePayload(row), false);
          if (dryRun) {
            // Contact/opportunity payloads require a real-shaped UUID to pass validation
            // even though nothing is written; the id never leaves this preview response.
            organizationId = randomUUID();
          } else {
            const { data, error } = await db.from('organizations').insert(validated).select('*').single();
            if (error) throw error;
            organizationId = data.id as string;
            await logLeadActivity(db, 'organization', organizationId, row.business, 'Imported from Clay CSV lead list.', {
              source: 'clay_csv_import',
              place_id: row.placeId,
            });
            registerCreatedOrganization(index, contactsByOrg, opportunitiesByOrg, organizationId, data as OrganizationLite);
          }
          organizationAction = 'create';
          totals.organizations_created += 1;
        } else {
          const { payload, changed } = buildOrganizationUpdatePayload(match.organization, row);
          organizationId = match.organization.id;
          if (!changed) {
            organizationAction = 'skip';
            totals.organizations_skipped += 1;
          } else {
            const validated = organizationPayload(payload, true);
            if (!dryRun) {
              const { error } = await db
                .from('organizations')
                .update({ ...validated, updated_at: new Date().toISOString() })
                .eq('id', organizationId);
              if (error) throw error;
              await logLeadActivity(db, 'organization', organizationId, row.business, 'Updated from Clay CSV lead list.', {
                source: 'clay_csv_import',
                place_id: row.placeId,
                changed_fields: Object.keys(payload),
              });
              Object.assign(match.organization, validated);
            }
            organizationAction = 'update';
            totals.organizations_updated += 1;
          }
        }

        const existingContacts = contactsByOrg.get(organizationId) ?? [];
        const contactPlan = planContactForRow(row, organizationId, existingContacts);
        let contactAction: RowResult['contact_action'] = 'none';
        if (contactPlan.action === 'create') {
          const validated = contactPayload(contactPlan.payload, false);
          if (!dryRun) {
            const { data, error } = await db.from('contacts').insert(validated).select('*').single();
            if (error) throw error;
            existingContacts.push(data as ContactLite);
            contactsByOrg.set(organizationId, existingContacts);
          }
          contactAction = 'create';
          totals.contacts_created += 1;
        } else if (contactPlan.action === 'update') {
          const validated = contactPayload(contactPlan.payload, true);
          if (!dryRun) {
            const { error } = await db
              .from('contacts')
              .update({ ...validated, updated_at: new Date().toISOString() })
              .eq('id', contactPlan.contactId);
            if (error) throw error;
            const target = existingContacts.find((item) => item.id === contactPlan.contactId);
            if (target) Object.assign(target, validated);
          }
          contactAction = 'update';
          totals.contacts_updated += 1;
        } else {
          totals.contacts_skipped += 1;
        }

        const existingOpportunities = opportunitiesByOrg.get(organizationId) ?? [];
        const opportunityPlan = planOpportunityForRow(row, organizationId, existingOpportunities);
        if (opportunityPlan.action === 'create') {
          const validated = opportunityPayload(opportunityPlan.payload, false);
          if (!dryRun) {
            const { data, error } = await db.from('opportunities').insert(validated).select('*').single();
            if (error) throw error;
            existingOpportunities.push(data as OpportunityLite);
            opportunitiesByOrg.set(organizationId, existingOpportunities);
          }
          totals.opportunities_created += 1;
        } else if (opportunityPlan.action === 'update') {
          const validated = opportunityPayload(opportunityPlan.payload, true);
          if (!dryRun) {
            const { error } = await db
              .from('opportunities')
              .update({ ...validated, updated_at: new Date().toISOString() })
              .eq('id', opportunityPlan.opportunityId);
            if (error) throw error;
            const target = existingOpportunities.find((item) => item.id === opportunityPlan.opportunityId);
            if (target) Object.assign(target, validated);
          }
          totals.opportunities_updated += 1;
        }

        results.push({
          row_number: rowNumber,
          business: row.business,
          place_id: row.placeId,
          organization_action: organizationAction,
          organization_match: match.matchedBy,
          organization_id: dryRun && organizationAction === 'create' ? undefined : organizationId,
          contact_action: contactAction,
          opportunity_action: opportunityPlan.action,
          warnings,
        });
      } catch (rowError) {
        rowErrors.push({ row_number: rowNumber, error: describeRowError(rowError) });
      }
    }

    res.status(200).json({ dry_run: dryRun, totals, rows: results, row_errors: rowErrors });
  } catch (error) {
    sendError(res, error, { route: '/api/leads/import', method: req.method });
  }
}

async function fetchLeadOrganizations(db: ReturnType<typeof getSupabase>): Promise<OrganizationLite[]> {
  const { data, error } = await db
    .from('organizations')
    .select(
      'id,name,website,industry,district,postcode,notes,address,lead_score,lead_score_reason,missing_function,staleness_evidence,hook_verified,source_place_id,archived_at,updated_at',
    );
  if (error) throw error;
  return (data ?? []) as OrganizationLite[];
}

async function fetchLeadActiveContacts(db: ReturnType<typeof getSupabase>): Promise<ContactLite[]> {
  const { data, error } = await db
    .from('contacts')
    .select('id,organization_id,full_name,phone,email,is_primary,archived_at')
    .is('archived_at', null);
  if (error) throw error;
  return (data ?? []) as ContactLite[];
}

async function fetchLeadOpportunities(db: ReturnType<typeof getSupabase>): Promise<OpportunityLite[]> {
  const { data, error } = await db
    .from('opportunities')
    .select('id,organization_id,stage,archived_at,draft_email_subject,draft_email_body');
  if (error) throw error;
  return (data ?? []) as OpportunityLite[];
}

function groupContactsByOrganization(contacts: ContactLite[]): Map<string, ContactLite[]> {
  const byOrg = new Map<string, ContactLite[]>();
  for (const contact of contacts) {
    if (!contact.organization_id) continue;
    const list = byOrg.get(contact.organization_id) ?? [];
    list.push(contact);
    byOrg.set(contact.organization_id, list);
  }
  return byOrg;
}

function groupOpportunitiesByOrganization(opportunities: OpportunityLite[]): Map<string, OpportunityLite[]> {
  const byOrg = new Map<string, OpportunityLite[]>();
  for (const opportunity of opportunities) {
    const list = byOrg.get(opportunity.organization_id) ?? [];
    list.push(opportunity);
    byOrg.set(opportunity.organization_id, list);
  }
  return byOrg;
}

function registerCreatedOrganization(
  index: DedupeIndex,
  contactsByOrg: Map<string, ContactLite[]>,
  opportunitiesByOrg: Map<string, OpportunityLite[]>,
  organizationId: string,
  organization: OrganizationLite,
) {
  index.orgsById.set(organizationId, organization);
  if (organization.source_place_id) index.byPlaceId.set(organization.source_place_id, organization);
  const host = normalizeDomain(organization.website);
  if (host) {
    const list = index.byDomain.get(host) ?? [];
    list.push(organization);
    index.byDomain.set(host, list);
  }
  contactsByOrg.set(organizationId, []);
  opportunitiesByOrg.set(organizationId, []);
}

async function logLeadActivity(
  db: ReturnType<typeof getSupabase>,
  subjectType: 'organization',
  subjectId: string,
  label: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('activities').insert({
    subject_type: subjectType,
    subject_id: subjectId,
    subject_label: label,
    subject_path: `/freelance/organizations/${subjectId}`,
    kind: 'system',
    body,
    metadata,
  });
  if (error) throw error;
}

function describeRowError(error: unknown): string {
  if (error instanceof HttpError) {
    const fields = (error.details?.fields ?? {}) as Record<string, string>;
    const detail = Object.values(fields)[0];
    return detail ? `${error.message}: ${detail}` : error.message;
  }
  return error instanceof Error ? error.message : 'Import failed for this row';
}
