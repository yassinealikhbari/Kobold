import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { createApplication, getApplicationByJobKey, updateApplication, type ApplicationStatus } from '../_lib/applications.js';
import { isUuid } from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';
import type { LiveJob } from '../_lib/live-jobs.js';

const STATUSES = new Set(['saved', 'applied', 'interviewing', 'offer', 'rejected']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = typeof req.query.id === 'string' ? req.query.id : '';
  const isCollection = raw === '_collection';
  try {
    await requireAuth(req);

    if (isCollection) {
      if (req.method === 'GET') {
        const jobKey = typeof req.query.job_key === 'string' ? req.query.job_key : '';
        if (jobKey) {
          res.status(200).json({ application: await getApplicationByJobKey(jobKey) });
          return;
        }
        const { data, error } = await getSupabase().from('applications').select('*').order('updated_at', { ascending: false });
        if (error) throw error;
        res.status(200).json({ applications: data ?? [] });
        return;
      }

      if (req.method === 'POST') {
        const job = readJob(req.body?.job);
        const coverLetter = typeof req.body?.cover_letter === 'string' ? req.body.cover_letter : undefined;
        res.status(200).json({ application: await createApplication(job, coverLetter) });
        return;
      }

      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const id = raw;
    if (!id) {
      res.status(400).json({ error: 'Application id is required' });
      return;
    }

    if (req.method === 'PATCH') {
      const status = req.body?.status;
      if (status !== undefined && !STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      const organizationId = req.body?.organization_id;
      if (
        organizationId !== undefined &&
        organizationId !== null &&
        (typeof organizationId !== 'string' || !isUuid(organizationId))
      ) {
        res.status(400).json({ error: 'Invalid organization_id' });
        return;
      }

      const application = await updateApplication(id, {
        status: status as ApplicationStatus | undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
        cover_letter: typeof req.body?.cover_letter === 'string' ? req.body.cover_letter : undefined,
        organization_id: organizationId as string | null | undefined,
      });

      res.status(200).json({ application });
      return;
    }

    if (req.method === 'DELETE') {
      const { error } = await getSupabase().from('applications').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, {
      route: isCollection ? '/api/applications' : '/api/applications/:id',
      method: req.method,
      entityId: isCollection ? undefined : raw,
    });
  }
}

function readJob(value: unknown): LiveJob {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'A live job snapshot is required');
  const job = value as Partial<LiveJob>;
  if (!job.id || !job.title || !job.company || !job.url) throw new HttpError(400, 'Job snapshot is incomplete');
  return job as LiveJob;
}
