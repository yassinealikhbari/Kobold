import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { findLiveJob } from '../_lib/live-jobs.js';

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

    const job = await findLiveJob(id);
    if (!job) {
      res.status(404).json({ error: 'This listing is no longer available from its source.' });
      return;
    }
    res.status(200).json({ job });
  } catch (error) {
    sendError(res, error, { route: '/api/jobs/:id', method: req.method });
  }
}
