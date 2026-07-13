import { VUE_RE } from '../filters.js';
import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, validRawJob } from './utils.js';

type RemoteOkJob = {
  position?: string;
  company?: string;
  tags?: string[];
  location?: string;
  url?: string;
  date?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
};

export const remoteOkAdapter: SourceAdapter = {
  name: 'remoteok',
  async fetchJobs() {
    const response = await fetchJson<RemoteOkJob[]>('https://remoteok.com/api', {
      headers: {
        'User-Agent': 'Vue Job Hunter/1.0 (personal job search tool)',
      },
    });

    return response
      .slice(1)
      .filter((item) => VUE_RE.test((item.tags ?? []).join(' ')))
      .map((item): RawJob | null =>
        validRawJob({
          title: item.position ?? '',
          company: item.company?.trim() || '(see listing)',
          location: item.location,
          url: item.url ?? '',
          tags: item.tags,
          descriptionHtml: item.description,
          remote: true,
          postedAt: dateToIso(item.date),
          salaryText: formatSalary(item.salary_min, item.salary_max),
        }),
      )
      .filter(Boolean) as RawJob[];
  },
};

function formatSalary(min: number | undefined, max: number | undefined): string | undefined {
  if (!min && !max) return undefined;
  if (min && max) return `${min}-${max}`;
  return String(min ?? max);
}
