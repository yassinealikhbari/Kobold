import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, getArrayText, validRawJob } from './utils.js';

type WorkingNomadsJob = {
  url?: string;
  title?: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  tags?: string[];
  location?: string;
  pub_date?: string;
};

export const workingNomadsAdapter: SourceAdapter = {
  name: 'workingnomads',
  async fetchJobs() {
    const response = await fetchJson<WorkingNomadsJob[]>('https://www.workingnomads.com/api/exposed_jobs/');

    return { jobs: response
      .map((item): RawJob | null => {
        const tags = getArrayText(item.tags);

        return validRawJob({
          title: item.title ?? '',
          company: item.company_name?.trim() || '(see listing)',
          location: item.location,
          url: item.url ?? '',
          tags: [item.category_name, ...tags].filter(Boolean) as string[],
          descriptionHtml: item.description,
          remote: true,
          postedAt: dateToIso(item.pub_date),
        });
      })
      .filter(Boolean) as RawJob[] };
  },
};
