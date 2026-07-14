import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, validRawJob } from './utils.js';

type RemotiveResponse = {
  jobs?: RemotiveJob[];
};

type RemotiveJob = {
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  description?: string;
  salary?: string;
  tags?: string[];
};

export const remotiveAdapter: SourceAdapter = {
  name: 'remotive',
  async fetchJobs() {
    const response = await fetchJson<RemotiveResponse>(
      'https://remotive.com/api/remote-jobs?category=software-dev&limit=100',
    );
    return {
      jobs: (response.jobs ?? [])
        .map(
          (item): RawJob | null =>
            validRawJob({
              title: item.title ?? '',
              company: item.company_name?.trim() || '(see listing)',
              location: item.candidate_required_location?.trim() || 'Remote worldwide',
              url: item.url ?? '',
              tags: [item.category, ...(item.tags ?? [])].filter(Boolean) as string[],
              jobTypes: item.job_type ? [item.job_type] : undefined,
              descriptionHtml: item.description,
              remote: true,
              postedAt: dateToIso(item.publication_date),
              salaryText: item.salary?.trim() || undefined,
            }),
        )
        .filter(Boolean) as RawJob[],
    };
  },
};
