import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { personalizeJobs } from '../_lib/job-fit.js';
import { fetchLiveJobs } from '../_lib/live-jobs.js';
import { getOrCreateProfile } from '../_lib/profile.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAuth(req);
    const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const [discovery, profile] = await Promise.all([
      fetchLiveJobs(source ? [source] : undefined, forceRefresh),
      getOrCreateProfile(),
    ]);
    const { issues, coverage, fetched_at: fetchedAt, cache } = discovery;
    const jobs = personalizeJobs(discovery.jobs, profile);
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
    const sort = req.query.sort === 'fit' ? 'fit' : 'posted';
    const filtered = jobs
      .filter((job) => !req.query.workplace || job.workplace === req.query.workplace)
      .filter((job) => {
        const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
        return !q || `${job.title} ${job.company} ${job.location ?? ''}`.toLowerCase().includes(q);
      })
      .sort((left, right) => {
        if (sort === 'posted') return (right.posted_at ?? '').localeCompare(left.posted_at ?? '');
        return right.fit.score - left.fit.score || (right.posted_at ?? '').localeCompare(left.posted_at ?? '');
      });
    const from = (page - 1) * pageSize;
    const pageJobs = filtered.slice(from, from + pageSize);

    res.status(200).json({
      jobs: pageJobs,
      total: filtered.length,
      page,
      pageSize,
      hasMore: from + pageSize < filtered.length,
      issues,
      coverage,
      cache,
      fetchedAt,
    });
  } catch (error) {
    sendError(res, error, { route: '/api/jobs', method: req.method });
  }
}
