import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { truncateRawJob, unixSecondsToIso, validRawJob } from './utils.js';

type ArbeitnowResponse = {
  data?: ArbeitnowJob[];
};

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

export const arbeitnowAdapter: SourceAdapter = {
  name: 'arbeitnow',
  async fetchJobs() {
    const jobs: RawJob[] = [];

    for (let page = 1; page <= 5; page += 1) {
      const response = await fetchJson<ArbeitnowResponse>(
        `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
      );

      for (const item of response.data ?? []) {
        const title = item.title?.trim() ?? '';
        const tags = item.tags ?? [];

        const raw = validRawJob({
          title,
          company: item.company_name?.trim() || '(see listing)',
          location: item.location,
          url: item.url ?? `https://www.arbeitnow.com/jobs/${item.slug ?? ''}`,
          tags,
          jobTypes: item.job_types,
          descriptionHtml: item.description,
          remote: item.remote,
          postedAt: unixSecondsToIso(item.created_at),
        });

        if (raw) jobs.push(raw);
      }

      if (page < 5) await sleep(500);
    }

    return { jobs: jobs.map(truncateRawJob) };
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
