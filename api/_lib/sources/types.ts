export interface RawJob {
  title: string;
  company: string;
  location?: string;
  url: string;
  applyUrl?: string;
  tags?: string[];
  descriptionHtml?: string;
  descriptionText?: string;
  remote?: boolean;
  postedAt?: string;
  salaryText?: string;
  jobTypes?: string[];
  language?: string;
}

export interface SourceAdapter {
  name: string;
  fetchJobs(): Promise<SourceFetchResult>;
}

export type SourceFetchResult = {
  jobs: RawJob[];
  warnings?: string[];
};
