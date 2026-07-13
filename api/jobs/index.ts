import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { getSupabase } from '../_lib/db.js';
import { serializeJob, type JobStatus } from '../_lib/jobs.js';

const PAGE_SIZE = 50;
const SORTS = new Set(['score', 'posted']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAuth(req);

    const statuses = getStatuses(req.query.status);
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const sort = typeof req.query.sort === 'string' && SORTS.has(req.query.sort) ? req.query.sort : 'score';
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = getSupabase()
      .from('jobs')
      .select('*, applications(id,status)', { count: 'exact' })
      .in('status', statuses)
      .range(from, to);

    if (typeof req.query.workplace === 'string' && req.query.workplace) {
      query = query.eq('workplace', req.query.workplace);
    }

    if (typeof req.query.source === 'string' && req.query.source) {
      query = query.contains('sources', [req.query.source]);
    }

    if (typeof req.query.minScore === 'string' && req.query.minScore) {
      query = query.gte('score', Number(req.query.minScore));
    }

    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const q = escapeIlike(req.query.q.trim());
      query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%`);
    }

    if (sort === 'posted') {
      query = query.order('posted_at', { ascending: false, nullsFirst: false }).order('first_seen_at', {
        ascending: false,
      });
    } else {
      query = query
        .order('score', { ascending: false })
        .order('posted_at', { ascending: false, nullsFirst: false })
        .order('first_seen_at', { ascending: false });
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      jobs: (data ?? []).map((row) => serializeJob(row as Parameters<typeof serializeJob>[0])),
      total: count ?? 0,
    });
  } catch (error) {
    sendError(res, error);
  }
}

function getStatuses(value: unknown): JobStatus[] {
  if (typeof value !== 'string' || !value) return ['active'];
  return value
    .split(',')
    .filter((status): status is JobStatus => ['active', 'stale', 'expired', 'dismissed'].includes(status));
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}
