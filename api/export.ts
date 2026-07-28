import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from './_lib/auth.js';
import { toCsv } from './_lib/csv.js';
import { getSupabase } from './_lib/db.js';

const EXPORTS = {
  organizations: [
    'id', 'name', 'website', 'industry', 'district', 'postcode', 'country', 'language',
    'origin', 'status', 'notes', 'address', 'lead_score', 'lead_score_reason',
    'missing_function', 'staleness_evidence', 'hook_verified', 'source_place_id',
    'archived_at', 'created_at', 'updated_at',
  ],
  contacts: [
    'id', 'organization_id', 'full_name', 'role', 'email', 'phone', 'instagram',
    'linkedin', 'language', 'is_primary', 'notes', 'archived_at', 'created_at', 'updated_at',
  ],
  opportunities: [
    'id', 'organization_id', 'title', 'stage', 'value_cents', 'currency', 'confidence',
    'expected_close', 'lost_reason', 'archived_at', 'stage_changed_at', 'created_at', 'updated_at',
  ],
  activities: [
    'id', 'subject_type', 'subject_id', 'subject_label', 'kind', 'body', 'metadata',
    'occurred_at', 'created_at',
  ],
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const entity = typeof req.query.entity === 'string' ? req.query.entity : '';
    if (!(entity in EXPORTS)) throw new HttpError(400, 'Invalid export entity');
    const columns = EXPORTS[entity as keyof typeof EXPORTS];
    const { data, error } = await getSupabase()
      .from(entity)
      .select(columns.join(','))
      .order('created_at', { ascending: true })
      .limit(50000);
    if (error) throw error;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kobold-${entity}.csv"`);
    res.status(200).send(toCsv((data ?? []) as unknown as Record<string, unknown>[], [...columns]));
  } catch (error) {
    sendError(res, error, { route: '/api/export', method: req.method });
  }
}
