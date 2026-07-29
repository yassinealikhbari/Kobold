import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  isUuid,
  OPPORTUNITY_STAGES,
  opportunityPayload,
  queryBoolean,
  queryEnum,
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
  const raw = typeof req.query.id === 'string' ? req.query.id : '';
  const isCollection = raw === '_collection';
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (isCollection) {
      if (req.method === 'GET') {
        const stage = queryEnum(req.query.stage, 'stage', OPPORTUNITY_STAGES);
        const archived = queryBoolean(req.query.archived, 'archived') ?? false;
        const organizationId = singleQuery(req.query.organization_id);
        if (organizationId && !isUuid(organizationId)) throw new HttpError(400, 'Invalid organization_id');

        let query = db
          .from('opportunities')
          .select('*, organization:organizations(id,name,status,archived_at,missing_function)')
          .order('stage_changed_at', { ascending: false });
        query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
        if (stage) query = query.eq('stage', stage);
        if (organizationId) query = query.eq('organization_id', organizationId);
        const { data, error } = await query;
        if (error) throw error;
        const opportunities = data ?? [];
        const ids = opportunities.map((item) => item.id);
        const taskCounts = new Map<string, number>();
        if (ids.length) {
          const { data: tasks, error: taskError } = await db
            .from('tasks')
            .select('subject_id')
            .eq('subject_type', 'opportunity')
            .is('done_at', null)
            .in('subject_id', ids);
          if (taskError) throw taskError;
          for (const task of tasks ?? []) {
            taskCounts.set(task.subject_id, (taskCounts.get(task.subject_id) ?? 0) + 1);
          }
        }
        res.status(200).json({
          opportunities: opportunities.map((item) => ({
            ...item,
            open_task_count: taskCounts.get(item.id) ?? 0,
          })),
        });
        return;
      }

      if (req.method === 'POST') {
        const payload = validateOpportunityState(opportunityPayload(req.body ?? {}));
        const { data, error } = await db.from('opportunities').insert(payload).select('*, organization:organizations(id,name,status,archived_at,missing_function)').single();
        if (error) throw error;
        res.status(201).json({ opportunity: data });
        return;
      }

      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const id = readId(raw);

    if (req.method === 'GET') {
      const { data, error } = await db
        .from('opportunities')
        .select('*, organization:organizations(id,name,status,archived_at,missing_function)')
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
        .select('*, organization:organizations(id,name,status,archived_at,missing_function)')
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
      route: isCollection ? '/api/opportunities' : '/api/opportunities/:id',
      method: req.method,
      entityId: isCollection ? undefined : raw,
    });
  }
}

function readId(raw: string): string {
  if (!isUuid(raw)) throw new HttpError(400, 'A valid opportunity id is required');
  return raw;
}

function singleQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
