import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { fetchLiveJobs } from '../_lib/live-jobs.js';

const PAGE_SIZE = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAuth(req);
    const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined;
    const { jobs, issues } = await fetchLiveJobs(source ? [source] : undefined);
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const sort = req.query.sort === 'posted' ? 'posted' : 'score';
    const filtered = jobs
      .filter((job) => !req.query.workplace || job.workplace === req.query.workplace)
      .filter((job) => !req.query.minScore || job.score >= Number(req.query.minScore))
      .filter((job) => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
        return !q || `${job.title} ${job.company} ${job.location ?? ''}`.toLowerCase().includes(q);
      })
      .sort((left, right) => {
        if (sort === 'posted') return (right.posted_at ?? '').localeCompare(left.posted_at ?? '');
        return right.score - left.score || (right.posted_at ?? '').localeCompare(left.posted_at ?? '');
      });
    const from = (page - 1) * PAGE_SIZE;
    const pageJobs = filtered.slice(from, from + PAGE_SIZE);

    res.status(200).json({
      jobs: pageJobs,
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      hasMore: from + PAGE_SIZE < filtered.length,
      issues,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendError(res, error, { route: '/api/jobs', method: req.method });
  }
}
