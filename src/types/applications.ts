export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export type Application = {
  id: string;
  job_key: string;
  job_snapshot: import('./jobs').Job;
  status: ApplicationStatus;
  cover_letter: string | null;
  notes: string | null;
  applied_at: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};
