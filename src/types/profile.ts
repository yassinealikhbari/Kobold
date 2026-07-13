export type LanguageEntry = {
  lang: string;
  level: string;
};

export type WorkHistoryEntry = {
  company: string;
  role: string;
  from: string;
  to: string;
  highlights: string[];
};

export type CandidateProfile = {
  id: 1;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  summary: string | null;
  skills: string[];
  languages: LanguageEntry[];
  work_history: WorkHistoryEntry[];
  cv_path: string | null;
  updated_at: string;
};
