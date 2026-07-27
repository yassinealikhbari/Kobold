import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from './_lib/auth.js';
import { isUuid } from './_lib/crm-validation.js';
import { getSupabase } from './_lib/db.js';
import { auditWebsite } from './_lib/site-audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const organizationId =
        typeof req.query.organization_id === 'string' ? req.query.organization_id : '';
      if (!isUuid(organizationId)) throw new HttpError(400, 'A valid organization_id is required');
      const { data, error } = await db
        .from('site_audits')
        .select('*')
        .eq('organization_id', organizationId)
        .order('audited_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.status(200).json({ audits: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const url = typeof req.body?.url === 'string' ? req.body.url : '';
      const organizationId =
        typeof req.body?.organization_id === 'string' ? req.body.organization_id : null;
      if (organizationId && !isUuid(organizationId)) {
        throw new HttpError(400, 'A valid organization_id is required');
      }
      const snapshot = await auditWebsite(url);
      const { data, error } = await db
        .from('site_audits')
        .insert({ organization_id: organizationId, ...snapshot })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201).json({ audit: data });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/audit', method: req.method });
  }
}

