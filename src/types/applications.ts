export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export type Application = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};
