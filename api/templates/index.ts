import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { getSupabase } from '../_lib/db.js';
import { templatePayload } from '../_lib/message-templates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('message_templates')
        .select('*')
        .is('archived_at', null)
        .order('template_key')
        .order('language');
      if (error) throw error;
      res.status(200).json({ templates: data ?? [] });
      return;
    }
    if (req.method === 'POST') {
      const payload = templatePayload(req.body ?? {});
      const { data, error } = await db.from('message_templates').insert(payload).select('*').single();
      if (error) throw error;
      res.status(201).json({ template: data });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/templates', method: req.method });
  }
}

