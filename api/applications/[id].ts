import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { updateApplication, type ApplicationStatus } from '../_lib/applications.js';
import { getSupabase } from '../_lib/db.js';

const STATUSES = new Set(['saved', 'applied', 'interviewing', 'offer', 'rejected']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'Application id is required' });
      return;
    }

    if (req.method === 'PATCH') {
      const status = req.body?.status;
      if (status !== undefined && !STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const application = await updateApplication(id, {
        status: status as ApplicationStatus | undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
        cover_letter: typeof req.body?.cover_letter === 'string' ? req.body.cover_letter : undefined,
      });

      res.status(200).json({ application });
      return;
    }

    if (req.method === 'DELETE') {
      const { error } = await getSupabase().from('applications').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, {
      route: '/api/applications/:id',
      method: req.method,
      entityId: typeof req.query.id === 'string' ? req.query.id : undefined,
    });
  }
}
