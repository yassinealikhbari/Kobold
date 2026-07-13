import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { getSupabase } from '../_lib/db.js';
import { serializeJob } from '../_lib/jobs.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      const [settings, hiddenJobs, runs] = await Promise.all([getSettings(), getHiddenJobs(), getRuns()]);
      res.status(200).json({ settings, hiddenJobs, runs });
      return;
    }

    if (req.method === 'PUT') {
      const notifyEnabled =
        typeof req.body?.notify_enabled === 'boolean' ? req.body.notify_enabled : undefined;
      const minScoreNotify =
        typeof req.body?.min_score_notify === 'number' ? req.body.min_score_notify : undefined;

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

async function getHiddenJobs() {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('*, applications(id,status)')
    .eq('status', 'dismissed')
    .order('last_seen_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map((row) => serializeJob(row as Parameters<typeof serializeJob>[0]));
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
