import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth';
import { getOrCreateApplication } from '../_lib/applications';
import { getSupabase } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      const { data, error } = await getSupabase()
        .from('applications')
        .select('*, jobs(id,title,company,url,status)')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ applications: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const jobId = typeof req.body?.job_id === 'string' ? req.body.job_id : '';
      if (!jobId) {
        res.status(400).json({ error: 'job_id is required' });
        return;
      }

      res.status(200).json({ application: await getOrCreateApplication(jobId) });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}
