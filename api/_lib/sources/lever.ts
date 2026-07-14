import { fetchBoardRegistry } from './ats-utils.js';
import { LEVER_BOARDS, type AtsBoard } from './ats-registry.js';
import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { validRawJob } from './utils.js';

type LeverJob = {
  id?: string;
  text?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
    team?: string;
    department?: string;
    level?: string;
  };
  country?: string;
  description?: string;
  descriptionPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string;
  createdAt?: number;
  salaryRange?: { currency?: string; interval?: string; min?: number; max?: number };
  salaryDescriptionPlain?: string;
};

export const leverAdapter: SourceAdapter = {
  name: 'lever',
  async fetchJobs() {
    const fetched = await fetchBoardRegistry(
      LEVER_BOARDS,
      (board) => fetchJson<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(board.token)}?mode=json`),
      (board) => `${board.company} (${board.token})`,
    );
    return {
      jobs: fetched.entries.flatMap(({ board, response }) =>
        response.map((job) => mapLeverJob(board, job)).filter(Boolean) as RawJob[],
      ),
      warnings: fetched.warnings,
    };
  },
};

export function mapLeverJob(board: AtsBoard, item: LeverJob): RawJob | null {
  const categories = item.categories ?? {};
  const locations = categories.allLocations?.length ? categories.allLocations : [categories.location];
  const location = Array.from(new Set([...locations, item.country].filter(Boolean) as string[])).join(' / ');
  const tags = [categories.team, categories.department, categories.level, item.workplaceType].filter(Boolean) as string[];

  return validRawJob({
    title: item.text ?? '',
    company: board.company,
    location: location || undefined,
    url: item.hostedUrl ?? '',
    applyUrl: item.applyUrl,
    tags,
    jobTypes: categories.commitment ? [categories.commitment] : undefined,
    descriptionHtml: item.description,
    descriptionText: item.descriptionPlain,
    remote: item.workplaceType === 'remote',
    postedAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
    salaryText: item.salaryDescriptionPlain ?? formatSalary(item.salaryRange),
  });
}

function formatSalary(range: LeverJob['salaryRange']): string | undefined {
  if (!range || (range.min === undefined && range.max === undefined)) return undefined;
  const amount = range.min !== undefined && range.max !== undefined ? `${range.min}-${range.max}` : String(range.min ?? range.max);
  return [range.currency, amount, range.interval].filter(Boolean).join(' ');
}
