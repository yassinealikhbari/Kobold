import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { isUuid } from '../_lib/crm-validation.js';
import { resolveSubject, SUBJECT_TYPES, type SubjectType } from '../_lib/crm-subjects.js';
import { getSupabase } from '../_lib/db.js';
import { taskScopeBounds, type TaskScope } from '../_lib/task-scopes.js';

const TASK_SCOPES: TaskScope[] = ['overdue', 'today', 'upcoming', 'all'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    const db = getSupabase();

    if (req.method === 'GET') {
      const scopeValue = single(req.query.scope) ?? 'all';
      if (!TASK_SCOPES.includes(scopeValue as TaskScope)) throw new HttpError(400, 'Invalid task scope');
      const subjectType = single(req.query.subject_type);
      const subjectId = single(req.query.subject_id);
      if ((subjectType && !subjectId) || (!subjectType && subjectId)) {
        throw new HttpError(400, 'subject_type and subject_id must be used together');
      }

      let query = db.from('tasks').select('*').is('done_at', null).order('due_at', { ascending: true, nullsFirst: false });
      const bounds = taskScopeBounds(scopeValue as TaskScope);
      if (bounds.from) query = query.gte('due_at', bounds.from);
      if (bounds.to) query = query.lt('due_at', bounds.to);
      if (subjectType && subjectId) {
        const subject = readSubject(subjectType, subjectId);
        query = query.eq('subject_type', subject.type).eq('subject_id', subject.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.status(200).json({ tasks: data ?? [] });
      return;
    }

    if (req.method === 'POST') {
      const title = requiredText(req.body?.title, 240, 'title');
      const dueAt = readDate(req.body?.due_at, 'due_at');
      let subjectFields: Record<string, unknown> = {};
      if (req.body?.subject_type || req.body?.subject_id) {
        const subject = readSubject(req.body?.subject_type, req.body?.subject_id);
        const resolved = await resolveSubject(subject.type, subject.id);
        subjectFields = {
          subject_type: resolved.type,
          subject_id: resolved.id,
          subject_label: resolved.label,
          subject_path: resolved.path,
          mode: resolved.mode,
        };
      }
      const { data, error } = await db
        .from('tasks')
        .insert({ ...subjectFields, title, due_at: dueAt })
        .select('*')
        .single();
      if (error) throw error;
      res.status(201).json({ task: data });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/tasks', method: req.method });
  }
}

function readSubject(typeValue: unknown, idValue: unknown): { type: SubjectType; id: string } {
  const type = single(typeValue);
  const id = single(idValue);
  if (!type || !SUBJECT_TYPES.includes(type as SubjectType)) throw new HttpError(400, 'Invalid subject_type');
  if (!id || !isUuid(id)) throw new HttpError(400, 'Invalid subject_id');
  return { type: type as SubjectType, id };
}

function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function requiredText(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return value.trim();
}

function readDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new HttpError(400, `Invalid ${field}`);
  return new Date(value).toISOString();
}

