import { ASHBY_BOARDS, type AtsBoard } from './ats-registry.js';
import { fetchBoardRegistry } from './ats-utils.js';
import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, validRawJob } from './utils.js';

type AshbyResponse = {
  jobs?: AshbyJob[];
};

type AshbyJob = {
  title?: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string }>;
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensationSalarySummary?: string;
  };
};

export const ashbyAdapter: SourceAdapter = {
  name: 'ashby',
  async fetchJobs() {
    const fetched = await fetchBoardRegistry(
      ASHBY_BOARDS,
      (board) =>
        fetchJson<AshbyResponse>(
          `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.token)}?includeCompensation=true`,
        ),
      (board) => `${board.company} (${board.token})`,
    );
    return {
      jobs: fetched.entries.flatMap(({ board, response }) =>
        (response.jobs ?? [])
          .filter((job) => job.isListed !== false)
          .map((job) => mapAshbyJob(board, job))
          .filter(Boolean) as RawJob[],
      ),
      warnings: fetched.warnings,
    };
  },
};

export function mapAshbyJob(board: AtsBoard, item: AshbyJob): RawJob | null {
  const locations = [item.location, ...(item.secondaryLocations ?? []).map((location) => location.location)].filter(
    Boolean,
  ) as string[];
  return validRawJob({
    title: item.title ?? '',
    company: board.company,
    location: Array.from(new Set(locations)).join(' / ') || undefined,
    url: item.jobUrl ?? '',
    applyUrl: item.applyUrl,
    tags: [item.department, item.team, item.workplaceType].filter(Boolean) as string[],
    jobTypes: item.employmentType ? [item.employmentType] : undefined,
    descriptionHtml: item.descriptionHtml,
    descriptionText: item.descriptionPlain,
    remote: item.isRemote === true || /^remote$/i.test(item.workplaceType ?? ''),
    postedAt: dateToIso(item.publishedAt),
    salaryText:
      item.compensation?.scrapeableCompensationSalarySummary ?? item.compensation?.compensationTierSummary,
  });
}
