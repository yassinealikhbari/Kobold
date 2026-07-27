import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  isUuid,
  OPPORTUNITY_STAGES,
  opportunityPayload,
  queryBoolean,
  queryEnum,
  validateOpportunityState,
} from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const stage = queryEnum(req.query.stage, 'stage', OPPORTUNITY_STAGES);
      const archived = queryBoolean(req.query.archived, 'archived') ?? false;
      const organizationId = singleQuery(req.query.organization_id);
      if (organizationId && !isUuid(organizationId)) throw new HttpError(400, 'Invalid organization_id');

      let query = db
        .from('opportunities')
        .select('*, organization:organizations(id,name,status,archived_at)')
        .order('stage_changed_at', { ascending: false });
      query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
      if (stage) query = query.eq('stage', stage);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw error;
      res.status(200).json({ opportunities: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const payload = validateOpportunityState(opportunityPayload(req.body ?? {}));
      const { data, error } = await db.from('opportunities').insert(payload).select('*, organization:organizations(id,name,status,archived_at)').single();
      if (error) throw error;
      res.status(201).json({ opportunity: data });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/opportunities', method: req.method });
  }
}

function singleQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

