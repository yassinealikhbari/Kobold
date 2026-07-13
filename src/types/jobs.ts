export type JobStatus = 'active' | 'stale' | 'expired' | 'dismissed';

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplace: 'remote' | 'hybrid' | 'onsite' | 'unknown';
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
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: JobStatus;
  application: {
    id: string;
    status: string;
  } | null;
};

export type IngestRun = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  found: number;
  matched: number;
  inserted: number;
  error: string | null;
};
