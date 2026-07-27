import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid, organizationPayload } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const id = readId(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const [
        { data: organization, error },
        { data: contacts, error: contactsError },
        { data: opportunities, error: opportunitiesError },
        { data: activities, error: activitiesError },
        { data: tasks, error: tasksError },
      ] =
        await Promise.all([
          db.from('organizations').select('*').eq('id', id).maybeSingle(),
          db
            .from('contacts')
            .select('*')
            .eq('organization_id', id)
            .is('archived_at', null)
            .order('is_primary', { ascending: false })
            .order('full_name'),
          db
            .from('opportunities')
            .select('*')
            .eq('organization_id', id)
            .is('archived_at', null)
            .order('stage_changed_at', { ascending: false }),
          db
            .from('activities')
            .select('*')
            .eq('subject_type', 'organization')
            .eq('subject_id', id)
            .order('occurred_at', { ascending: false })
            .limit(50),
          db
            .from('tasks')
            .select('*')
            .eq('subject_type', 'organization')
            .eq('subject_id', id)
            .is('done_at', null)
            .order('due_at', { ascending: true, nullsFirst: false }),
        ]);
      if (error) throw error;
      if (contactsError) throw contactsError;
      if (opportunitiesError) throw opportunitiesError;
      if (activitiesError) throw activitiesError;
      if (tasksError) throw tasksError;
      if (!organization) throw new HttpError(404, 'Organization not found');
      res.status(200).json({
        organization,
        contacts: contacts ?? [],
        opportunities: opportunities ?? [],
        activities: activities ?? [],
        tasks: tasks ?? [],
      });
      return;
    }

    if (req.method === 'PATCH') {
      const payload = organizationPayload(req.body ?? {}, true);
      if (req.body?.archived === false) Object.assign(payload, { archived_at: null });
      const { data, error } = await db
        .from('organizations')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ organization: data });
      return;
    }

    if (req.method === 'DELETE') {
      const archivedAt = new Date().toISOString();
      const { data, error } = await db
        .from('organizations')
        .update({ archived_at: archivedAt, updated_at: archivedAt })
        .eq('id', id)
        .is('archived_at', null)
        .select('*')
        .single();
      if (error) throw error;
      res.status(200).json({ organization: data });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, {
      route: '/api/organizations/:id',
      method: req.method,
      entityId: typeof req.query.id === 'string' ? req.query.id : undefined,
    });
  }
}

function readId(req: VercelRequest): string {
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!isUuid(id)) throw new HttpError(400, 'A valid organization id is required');
  return id;
}
