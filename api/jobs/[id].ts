import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { evaluateJobFit } from '../_lib/job-fit.js';
import { findLiveJob } from '../_lib/live-jobs.js';
import { getOrCreateProfile } from '../_lib/profile.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Job status is kept in this browser. Only GET is supported.' });
    return;
  }

  try {
    await requireAuth(req);
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'Job id is required' });
      return;
    }

    const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined;
    const [job, profile] = await Promise.all([findLiveJob(id, source), getOrCreateProfile()]);
    if (!job) {
      res.status(404).json({ error: 'This listing is no longer available from its source.' });
      return;
    }
    res.status(200).json({ job: { ...job, fit: evaluateJobFit(job, profile) } });
  } catch (error) {
    sendError(res, error, { route: '/api/jobs/:id', method: req.method });
  }
}
