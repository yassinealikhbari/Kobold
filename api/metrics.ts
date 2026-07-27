import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from './_lib/auth.js';
import {
  calculateCrmMetrics,
  type MetricActivity,
  type MetricOpportunity,
  type MetricOrganization,
} from './_lib/crm-metrics.js';
import { getSupabase } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const db = getSupabase();
    const [organizations, opportunities, activities] = await Promise.all([
      db.from('organizations').select('created_at'),
      db
        .from('opportunities')
        .select('id,stage,value_cents,currency,lost_reason')
        .is('archived_at', null),
      db
        .from('activities')
        .select('subject_id,kind,metadata,occurred_at')
        .eq('subject_type', 'opportunity')
        .order('occurred_at', { ascending: true })
        .limit(10000),
    ]);
    if (organizations.error) throw organizations.error;
    if (opportunities.error) throw opportunities.error;
    if (activities.error) throw activities.error;
    res.status(200).json({
      metrics: calculateCrmMetrics(
        (organizations.data ?? []) as MetricOrganization[],
        (opportunities.data ?? []) as MetricOpportunity[],
        (activities.data ?? []) as MetricActivity[],
      ),
    });
  } catch (error) {
    sendError(res, error, { route: '/api/metrics', method: req.method });
  }
}
