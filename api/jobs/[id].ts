import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth';
import { getSupabase } from '../_lib/db';
import { getJobById } from '../_lib/jobs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'Job id is required' });
      return;
    }

    if (req.method === 'GET') {
      const job = await getJobById(id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.status(200).json({ job });
      return;
    }

    if (req.method === 'PATCH') {
      const status = req.body?.status;
      if (status !== 'dismissed' && status !== 'active') {
        res.status(400).json({ error: 'Only dismissed or active status updates are supported' });
        return;
      }

      const { error } = await getSupabase().from('jobs').update({ status }).eq('id', id);
      if (error) throw error;

      const job = await getJobById(id);
      res.status(200).json({ job });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}
