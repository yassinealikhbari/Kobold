import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  isUuid,
  opportunityPayload,
  validateOpportunityState,
  type OpportunityLostReason,
  type OpportunityStage,
} from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

type CurrentOpportunity = {
  stage: OpportunityStage;
  lost_reason: OpportunityLostReason | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const id = readId(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await db
        .from('opportunities')
        .select('*, organization:organizations(id,name,status,archived_at)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, 'Opportunity not found');
      res.status(200).json({ opportunity: data });
      return;
    }

    if (req.method === 'PATCH') {
      const { data: current, error: currentError } = await db
        .from('opportunities')
        .select('stage,lost_reason')
        .eq('id', id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) throw new HttpError(404, 'Opportunity not found');

      const rawPatch = opportunityPayload(req.body ?? {}, true);
      const payload = validateOpportunityState(rawPatch, current as CurrentOpportunity);
      const now = new Date().toISOString();
      const stageChanged = payload.stage !== undefined && payload.stage !== current.stage;
      if (req.body?.archived === false) Object.assign(payload, { archived_at: null });
      const { data, error } = await db
        .from('opportunities')
        .update({
          ...payload,
          updated_at: now,
          ...(stageChanged ? { stage_changed_at: now } : {}),
        })
        .eq('id', id)
        .select('*, organization:organizations(id,name,status,archived_at)')
        .single();
      if (error) throw error;
      res.status(200).json({ opportunity: data });
      return;
    }

    if (req.method === 'DELETE') {
      const archivedAt = new Date().toISOString();
      const { data, error } = await db
        .from('opportunities')
        .update({ archived_at: archivedAt, updated_at: archivedAt })
        .eq('id', id)
        .is('archived_at', null)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ opportunity: data });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, {
      route: '/api/opportunities/:id',
      method: req.method,
      entityId: typeof req.query.id === 'string' ? req.query.id : undefined,
    });
  }
}

function readId(req: VercelRequest): string {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!isUuid(id)) throw new HttpError(400, 'A valid opportunity id is required');
  return id;
}

