import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { contactPayload, isUuid } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const id = readId(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await db
        .from('contacts')
        .select('*, organization:organizations(id,name,archived_at)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, 'Contact not found');
      res.status(200).json({ contact: data });
      return;
    }

    if (req.method === 'PATCH') {
      const payload = contactPayload(req.body ?? {}, true);
      if (req.body?.archived === false) Object.assign(payload, { archived_at: null });
      if (payload.is_primary && payload.organization_id) {
        const { error } = await db
          .from('contacts')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('organization_id', payload.organization_id)
          .neq('id', id);
        if (error) throw error;
      }
      const { data, error } = await db
        .from('contacts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ contact: data });
      return;
    }

    if (req.method === 'DELETE') {
      const archivedAt = new Date().toISOString();
      const { data, error } = await db
        .from('contacts')
        .update({ archived_at: archivedAt, updated_at: archivedAt })
        .eq('id', id)
        .is('archived_at', null)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ contact: data });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, {
      route: '/api/contacts/:id',
      method: req.method,
      entityId: typeof req.query.id === 'string' ? req.query.id : undefined,
    });
  }
}

function readId(req: VercelRequest): string {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!isUuid(id)) throw new HttpError(400, 'A valid contact id is required');
  return id;
}

