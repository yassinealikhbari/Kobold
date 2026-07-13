import { getSupabase } from './db.js';
import type { LiveJob } from './live-jobs.js';

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export type ApplicationRow = {
  id: string;
  job_key: string;
  job_snapshot: LiveJob;
  status: ApplicationStatus;
  cover_letter: string | null;
  notes: string | null;
  applied_at: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};

export async function createApplication(job: LiveJob, coverLetter?: string): Promise<ApplicationRow> {
  const existing = await getApplicationByJobKey(job.id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('applications')
    .insert({
      job_key: job.id,
      job_snapshot: job,
      status: 'applied',
      cover_letter: coverLetter ?? null,
      applied_at: now,
      status_changed_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ApplicationRow;
}

export async function getApplicationByJobKey(jobKey: string): Promise<ApplicationRow | null> {
  const { data, error } = await getSupabase().from('applications').select('*').eq('job_key', jobKey).maybeSingle();
  if (error) throw error;
  return data as ApplicationRow | null;
}

export async function updateApplication(id: string, patch: Partial<ApplicationRow>): Promise<ApplicationRow> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    payload.status = patch.status;
    payload.status_changed_at = new Date().toISOString();
    if (patch.status === 'applied') payload.applied_at = patch.applied_at ?? new Date().toISOString();
  }
  if ('notes' in patch) payload.notes = patch.notes ?? null;
  if ('cover_letter' in patch) payload.cover_letter = patch.cover_letter ?? null;

  const { data, error } = await getSupabase().from('applications').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as ApplicationRow;
}
