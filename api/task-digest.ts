import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from './_lib/auth.js';
import { getSupabase } from './_lib/db.js';
import { isAuthorizedIngestCron } from './_lib/ingest-auth.js';
import { berlinDate, buildTaskDigest, type DigestTask } from './_lib/task-digest.js';
import { endOfDayUtc } from './_lib/task-scopes.js';
import { sendTelegramText } from './_lib/telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    await authorize(req);
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

async function authorize(req: VercelRequest) {
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

