import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import {
  CRM_LANGUAGES,
  escapeLike,
  isUuid,
  organizationPayload,
  ORGANIZATION_STATUSES,
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
          warnings: duplicate ? [`An organization named "${duplicate.name}" already exists.`] : [],
        });
        return;
      }

      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const id = readId(raw);

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
      route: isCollection ? '/api/organizations' : '/api/organizations/:id',
      method: req.method,
      entityId: isCollection ? undefined : raw,
    });
  }
}

function readId(raw: string): string {
  if (!isUuid(raw)) throw new HttpError(400, 'A valid organization id is required');
  return raw;
}

function singleQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
