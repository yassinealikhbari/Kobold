import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid } from '../_lib/crm-validation.js';
import { resolveSubject, SUBJECT_TYPES, type SubjectType } from '../_lib/crm-subjects.js';
import { getSupabase } from '../_lib/db.js';

const ACTIVITY_KINDS = ['note', 'visit', 'dm', 'email', 'call', 'meeting', 'proposal'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const subject = readSubject(req.query.subject_type, req.query.subject_id);
      const { data, error } = await db
        .from('activities')
        .select('*')
        .eq('subject_type', subject.type)
        .eq('subject_id', subject.id)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      res.status(200).json({ activities: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const subject = readSubject(req.body?.subject_type, req.body?.subject_id);
      const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
      if (!ACTIVITY_KINDS.includes(kind as (typeof ACTIVITY_KINDS)[number])) {
        throw new HttpError(400, 'Invalid activity kind');
      }
      const body = nullableText(req.body?.body, 10000, 'body');
      if (kind === 'note' && !body) throw new HttpError(400, 'A note body is required');
      const resolved = await resolveSubject(subject.type, subject.id);
      const occurredAt = readDate(req.body?.occurred_at) ?? new Date().toISOString();
      const { data, error } = await db
        .from('activities')
        .insert({
          subject_type: resolved.type,
          subject_id: resolved.id,
          subject_label: resolved.label,
          subject_path: resolved.path,
          kind,
          body,
          occurred_at: occurredAt,
        })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201).json({ activity: data });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/activities', method: req.method });
  }
}

function readSubject(typeValue: unknown, idValue: unknown): { type: SubjectType; id: string } {
  const type = Array.isArray(typeValue) ? typeValue[0] : typeValue;
  const id = Array.isArray(idValue) ? idValue[0] : idValue;
  if (typeof type !== 'string' || !SUBJECT_TYPES.includes(type as SubjectType)) {
    throw new HttpError(400, 'A valid subject_type is required');
  }
  if (typeof id !== 'string' || !isUuid(id)) throw new HttpError(400, 'A valid subject_id is required');
  return { type: type as SubjectType, id };
}

function nullableText(value: unknown, max: number, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return value.trim();
}

function readDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new HttpError(400, 'Invalid occurred_at');
  return new Date(value).toISOString();
}
