import { HttpError } from './auth.js';
import { getSupabase } from './db.js';

export const SUBJECT_TYPES = ['organization', 'contact', 'opportunity', 'application'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export type ResolvedSubject = {
  type: SubjectType;
  id: string;
  label: string;
  path: string;
  mode: 'freelance' | 'jobs';
};

export async function resolveSubject(type: SubjectType, id: string): Promise<ResolvedSubject> {
  const db = getSupabase();

  if (type === 'organization') {
    const { data, error } = await db.from('organizations').select('name').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Organization not found');
    return { type, id, label: data.name, path: `/freelance/organizations/${id}`, mode: 'freelance' };
  }

  if (type === 'contact') {
    const { data, error } = await db.from('contacts').select('full_name').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Contact not found');
    return { type, id, label: data.full_name, path: `/freelance/contacts/${id}`, mode: 'freelance' };
  }

  if (type === 'opportunity') {
    const { data, error } = await db.from('opportunities').select('title').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Opportunity not found');
    return { type, id, label: data.title, path: `/freelance/opportunities/${id}`, mode: 'freelance' };
  }

  const { data, error } = await db
    .from('applications')
    .select('job_snapshot')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Application not found');
  const snapshot = data.job_snapshot as { title?: string; company?: string } | null;
  const label = [snapshot?.title, snapshot?.company].filter(Boolean).join(' · ') || 'Application';
  return { type, id, label, path: '/tracker', mode: 'jobs' };
}

