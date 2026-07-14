import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { getSupabase } from '../_lib/db.js';
import { describeServerError } from '../_lib/logger.js';
import { isTelegramConfigured } from '../_lib/telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

      if (notifyEnabled && !isTelegramConfigured()) {
        throw new HttpError(400, 'Configure Telegram credentials before enabling notifications');
      }
      if (notifyEnabled && (await getNotificationStatus()).migrationRequired) {
        throw new HttpError(409, 'Apply migration 006_job_fingerprints.sql before enabling notifications');
      }

      const payload: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (notifyEnabled !== undefined) payload.notify_enabled = notifyEnabled;
      if (minScoreNotify !== undefined) payload.min_score_notify = minScoreNotify;

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
