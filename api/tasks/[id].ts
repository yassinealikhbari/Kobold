import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!isUuid(id)) throw new HttpError(400, 'A valid task id is required');
    const db = getSupabase();

    if (req.method === 'PATCH') {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ('done' in (req.body ?? {})) {
        if (typeof req.body.done !== 'boolean') throw new HttpError(400, 'done must be true or false');
        payload.done_at = req.body.done ? new Date().toISOString() : null;
      }
      if ('title' in (req.body ?? {})) {
        if (typeof req.body.title !== 'string' || !req.body.title.trim() || req.body.title.trim().length > 240) {
          throw new HttpError(400, 'Invalid title');
        }
        payload.title = req.body.title.trim();
      }
      if ('due_at' in (req.body ?? {})) {
        if (req.body.due_at === null || req.body.due_at === '') payload.due_at = null;
        else if (typeof req.body.due_at === 'string' && !Number.isNaN(Date.parse(req.body.due_at))) {
          payload.due_at = new Date(req.body.due_at).toISOString();
        } else throw new HttpError(400, 'Invalid due_at');
      }
      const { data, error } = await db.from('tasks').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      res.status(200).json({ task: data });
      return;
    }

    if (req.method === 'DELETE') {
      const { error } = await db.from('tasks').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/tasks/:id', method: req.method });
  }
}

