import { fetchBoardRegistry, unknownToStrings } from './ats-utils.js';
import { GREENHOUSE_BOARDS, type AtsBoard } from './ats-registry.js';
import { fetchJson } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, decodeEntities, validRawJob } from './utils.js';

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
};

type GreenhouseJob = {
  id?: number;
  title?: string;
  updated_at?: string;
  absolute_url?: string;
  language?: string;
  location?: { name?: string };
  content?: string;
  metadata?: Array<{ name?: string; value?: unknown }> | null;
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string; location?: string }>;
};

export const greenhouseAdapter: SourceAdapter = {
  name: 'greenhouse',
  async fetchJobs() {
    const fetched = await fetchBoardRegistry(
      GREENHOUSE_BOARDS,
      (board) =>
        fetchJson<GreenhouseResponse>(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`,
        ),
      (board) => `${board.company} (${board.token})`,
    );
    return {
      jobs: fetched.entries.flatMap(({ board, response }) =>
        (response.jobs ?? []).map((job) => mapGreenhouseJob(board, job)).filter(Boolean) as RawJob[],
      ),
      warnings: fetched.warnings,
    };
  },
};

export function mapGreenhouseJob(board: AtsBoard, item: GreenhouseJob): RawJob | null {
  const metadata = (item.metadata?.flatMap((entry) => [entry.name, ...unknownToStrings(entry.value)]) ?? []).filter(
    (value): value is string => Boolean(value),
  );
  const tags = [
    ...metadata,
    ...(item.departments ?? []).map((entry) => entry.name),
    ...(item.offices ?? []).flatMap((entry) => [entry.name, entry.location]),
  ].filter(Boolean) as string[];
  const descriptionHtml = item.content ? decodeEntities(decodeEntities(item.content)) : undefined;

  return validRawJob({
    title: item.title ?? '',
    company: board.company,
    location: item.location?.name,
    url: item.absolute_url ?? '',
    applyUrl: item.absolute_url,
    tags,
    jobTypes: metadata,
    descriptionHtml,
    postedAt: dateToIso(item.updated_at),
    language: item.language,
  });
}
