export type JobStatus = 'active' | 'stale' | 'expired' | 'dismissed';
export type Technology = 'vue' | 'nuxt' | 'react';
export type EmploymentType = 'full-time' | 'contract' | 'freelance' | 'unknown';
export type InboxView = 'new' | 'all' | 'saved';
export type FitLabel = 'strong' | 'possible' | 'stretch' | 'unrated';

export type JobFit = {
  label: FitLabel;
  score: number;
  reasons: string[];
  risks: string[];
  matched_skills: string[];
  requested_skills: string[];
};

export type SourceListing = {
  source: string;
  url: string;
  apply_url: string | null;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  role_family: 'frontend' | 'ui' | 'product' | 'full-stack' | 'software' | null;
  location: string | null;
  workplace: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  url: string;
  apply_url: string | null;
  ats: string | null;
  sources: string[];
  source_listings: SourceListing[];
  tags: string[];
  technologies: Technology[];
  employment_types: EmploymentType[];
  description_html: string | null;
  description_text: string | null;
  seniority: string | null;
  german_required: boolean;
  salary_text: string | null;
  score: number;
  score_reasons: string[];
  eligibility_warnings: string[];
  fit: JobFit;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: JobStatus;
  application: {
    id: string;
    status: string;
  } | null;
};

export type SourceCoverage = {
  source: string;
  status: 'ok' | 'degraded' | 'empty' | 'failed';
  fetched: number;
  parsed: number;
  eligible: number;
  returned: number;
  duplicates: number;
  excluded: Record<string, number>;
  duration_ms: number;
  cache_hit: boolean;
  warnings: string[];
  error?: string;
};

export type DiscoveryIssue = {
  source: string;
  error: string;
  severity: 'warning' | 'error';
};

export type IngestRun = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  found: number;
  matched: number;
  inserted: number;
  inserted_active?: number;
  inserted_dismissed?: number;
  updated?: number;
  error: string | null;
  outcome?: 'success' | 'empty' | 'partial' | 'failed';
  duration_ms?: number | null;
};

export type SourceHealth = {
  source: string;
  last_run_at: string;
  last_success_at: string | null;
  last_nonempty_at: string | null;
  last_outcome: 'success' | 'empty' | 'partial' | 'failed';
  last_found: number;
  last_matched: number;
  last_inserted: number;
  last_duration_ms: number | null;
  last_error: string | null;
  consecutive_failures: number;
};
