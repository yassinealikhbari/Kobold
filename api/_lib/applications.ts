import { getSupabase } from './db.js';

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export type ApplicationRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrCreateApplication(jobId: string): Promise<ApplicationRow> {
  const existing = await getApplicationByJob(jobId);
  if (existing) return existing;

  const { data, error } = await getSupabase()
    .from('applications')
    .insert({ job_id: jobId, status: 'saved' })
    .select('*')
    .single();

  if (error) throw error;
  return data as ApplicationRow;
}

export async function getApplicationByJob(jobId: string): Promise<ApplicationRow | null> {
  const { data, error } = await getSupabase()
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as ApplicationRow | null;
}

export async function updateApplication(id: string, patch: Partial<ApplicationRow>): Promise<ApplicationRow> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status) {
    payload.status = patch.status;
    if (patch.status === 'applied') payload.applied_at = patch.applied_at ?? new Date().toISOString();
  }
  if ('notes' in patch) payload.notes = patch.notes ?? null;
  if ('cover_letter' in patch) payload.cover_letter = patch.cover_letter ?? null;

  const { data, error } = await getSupabase().from('applications').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as ApplicationRow;
}
