import type { VercelRequest, VercelResponse } from '@vercel/node';

import { activityDeleteThreshold } from '../_lib/activity-policy.js';
import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method !== 'DELETE') {
      res.setHeader('Allow', 'DELETE');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!isUuid(id)) throw new HttpError(400, 'A valid activity id is required');
    const { data, error } = await getSupabase()
      .from('activities')
      .delete()
      .eq('id', id)
      .gte('created_at', activityDeleteThreshold())
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, 'The 10-minute delete window has expired');
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error, { route: '/api/activities/:id', method: req.method });
  }
}
