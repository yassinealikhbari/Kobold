import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import {
  CRM_LANGUAGES,
  escapeLike,
  organizationPayload,
  ORGANIZATION_STATUSES,
  queryBoolean,
  queryEnum,
} from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const status = queryEnum(req.query.status, 'status', ORGANIZATION_STATUSES);
      const language = queryEnum(req.query.language, 'language', CRM_LANGUAGES);
      const hasWebsite = queryBoolean(req.query.has_website, 'has_website');
      const archived = queryBoolean(req.query.archived, 'archived') ?? false;
      const district = singleQuery(req.query.district)?.slice(0, 120);
      const q = singleQuery(req.query.q)?.trim();

      let query = db
        .from('organizations')
        .select('*')
        .order('updated_at', { ascending: false });
      query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
      if (status) query = query.eq('status', status);
      if (language) query = query.eq('language', language);
      if (district) query = query.ilike('district', escapeLike(district));
      if (hasWebsite === true) query = query.not('website', 'is', null);
      if (hasWebsite === false) query = query.is('website', null);
      if (q) query = query.ilike('name', `%${escapeLike(q)}%`);

      const { data, error } = await query;
      if (error) throw error;
      res.status(200).json({ organizations: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const payload = organizationPayload(req.body ?? {});
      const { data: duplicate, error: duplicateError } = await db
        .from('organizations')
        .select('id,name')
        .ilike('name', String(payload.name))
        .is('archived_at', null)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;

      const { data, error } = await db.from('organizations').insert(payload).select('*').single();
      if (error) throw error;
      res.status(201).json({
        organization: data,
        warnings: duplicate ? [`An organization named “${duplicate.name}” already exists.`] : [],
      });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/organizations', method: req.method });
  }
}

function singleQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

