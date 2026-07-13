import { getSupabase } from './db.js';

export type JobStatus = 'active' | 'stale' | 'expired' | 'dismissed';

export type JobResponse = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplace: string;
  url: string;
  apply_url: string | null;
  ats: string | null;
  sources: string[];
  tags: string[];
  description_html: string | null;
  description_text: string | null;
  seniority: string | null;
  german_required: boolean;
  salary_text: string | null;
  score: number;
  score_reasons: string[];
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: JobStatus;
  application: {
    id: string;
    status: string;
  } | null;
};

type JobRow = Omit<JobResponse, 'application'> & {
  applications?: Array<{ id: string; status: string }> | null;
};

export function serializeJob(row: JobRow): JobResponse {
  const application = row.applications?.[0] ?? null;
  const { applications: _applications, ...job } = row;

  return {
    ...job,
    application,
  };
}

export async function getJobById(id: string): Promise<JobResponse | null> {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('*, applications(id,status)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? serializeJob(data as JobRow) : null;
}
