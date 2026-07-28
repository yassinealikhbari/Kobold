import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  contactPayload,
  CRM_LANGUAGES,
  escapeLike,
  isUuid,
  queryBoolean,
  queryEnum,
} from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = typeof req.query.id === 'string' ? req.query.id : '';
  const isCollection = raw === '_collection';
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (isCollection) {
      if (req.method === 'GET') {
        const organizationId = singleQuery(req.query.organization_id);
        const language = queryEnum(req.query.language, 'language', CRM_LANGUAGES);
        const archived = queryBoolean(req.query.archived, 'archived') ?? false;
        const q = singleQuery(req.query.q)?.trim();
        if (organizationId && !isUuid(organizationId)) throw new HttpError(400, 'Invalid organization_id');

        let query = db
          .from('contacts')
          .select('*, organization:organizations(id,name,district,language,archived_at)')
          .order('updated_at', { ascending: false });
        query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
        if (organizationId) query = query.eq('organization_id', organizationId);
        if (language) query = query.eq('language', language);
        if (q) query = query.ilike('full_name', `%${escapeLike(q)}%`);

        const { data, error } = await query;
        if (error) throw error;
        res.status(200).json({ contacts: data ?? [] });
        return;
      }

      if (req.method === 'POST') {
        const payload = contactPayload(req.body ?? {});
        if (payload.is_primary && payload.organization_id) {
          const { error } = await db
            .from('contacts')
            .update({ is_primary: false, updated_at: new Date().toISOString() })
            .eq('organization_id', payload.organization_id);
          if (error) throw error;
        }
        const { data, error } = await db.from('contacts').insert(payload).select('*').single();
        if (error) throw error;
        res.status(201).json({ contact: data });
        return;
      }

      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const id = readId(raw);

    if (req.method === 'GET') {
      const { data, error } = await db
        .from('contacts')
        .select('*, organization:organizations(id,name,district,language,archived_at)')
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
      route: isCollection ? '/api/contacts' : '/api/contacts/:id',
      method: req.method,
      entityId: isCollection ? undefined : raw,
    });
  }
}

function readId(raw: string): string {
  if (!isUuid(raw)) throw new HttpError(400, 'A valid contact id is required');
  return raw;
}

function singleQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
