import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';
import { templatePayload } from '../_lib/message-templates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!isUuid(id)) throw new HttpError(400, 'A valid template id is required');
    const db = getSupabase();
    if (req.method === 'PATCH') {
      const payload = templatePayload(req.body ?? {}, true);
      const { data, error } = await db
        .from('message_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ template: data });
      return;
    }
    if (req.method === 'DELETE') {
      const timestamp = new Date().toISOString();
      const { data, error } = await db
        .from('message_templates')
        .update({ archived_at: timestamp, updated_at: timestamp })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ template: data });
      return;
    }
    res.setHeader('Allow', 'PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/templates/:id', method: req.method });
  }
}

