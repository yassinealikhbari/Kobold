import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { createApplication, getApplicationByJobKey } from '../_lib/applications.js';
import { getSupabase } from '../_lib/db.js';
import type { LiveJob } from '../_lib/live-jobs.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method === 'GET') {
      const jobKey = typeof req.query.job_key === 'string' ? req.query.job_key : '';
      if (jobKey) {
        res.status(200).json({ application: await getApplicationByJobKey(jobKey) });
        return;
      }
      const { data, error } = await getSupabase().from('applications').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ applications: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const job = readJob(req.body?.job);
      const coverLetter = typeof req.body?.cover_letter === 'string' ? req.body.cover_letter : undefined;
      res.status(200).json({ application: await createApplication(job, coverLetter) });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/applications', method: req.method });
  }
}

function readJob(value: unknown): LiveJob {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'A live job snapshot is required');
  const job = value as Partial<LiveJob>;
  if (!job.id || !job.title || !job.company || !job.url) throw new HttpError(400, 'Job snapshot is incomplete');
  return job as LiveJob;
}
