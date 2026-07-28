import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth.js';
import { evaluateJobFit, personalizeJobs } from '../_lib/job-fit.js';
import { fetchLiveJobs, findLiveJob } from '../_lib/live-jobs.js';
import { getOrCreateProfile } from '../_lib/profile.js';
import { sourceAdapters } from '../_lib/sources/index.js';
import { getSupabase } from '../_lib/db.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const raw = typeof req.query.id === 'string' ? req.query.id : '';
  const isCollection = raw === '_collection';
  const isSyncStatus = raw === 'sync-status';

  try {
    await requireAuth(req);

    if (isCollection) {
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
      return;
    }

    if (isSyncStatus) {
      const { data, error } = await getSupabase()
        .from('ingest_runs')
        .select('*')
        .in('source', [...sourceAdapters.map((adapter) => adapter.name), 'lifecycle'])
        .order('started_at', { ascending: false })
        .limit(80);

      if (error) throw error;

      const latestBySource = new Map<string, unknown>();
      for (const run of data ?? []) {
        const source = typeof run.source === 'string' ? run.source : '';
        if (source && !latestBySource.has(source)) latestBySource.set(source, run);
      }

      res.status(200).json({ runs: Array.from(latestBySource.values()) });
      return;
    }

    const id = raw;
    if (!id) {
      res.status(400).json({ error: 'Job id is required' });
      return;
    }

    const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined;
    const [job, profile] = await Promise.all([findLiveJob(id, source), getOrCreateProfile()]);
    if (!job) {
      res.status(404).json({ error: 'This listing is no longer available from its source.' });
      return;
    }
    res.status(200).json({ job: { ...job, fit: evaluateJobFit(job, profile) } });
  } catch (error) {
    sendError(res, error, {
      route: isCollection ? '/api/jobs' : isSyncStatus ? '/api/jobs/sync-status' : '/api/jobs/:id',
      method: req.method,
    });
  }
}
