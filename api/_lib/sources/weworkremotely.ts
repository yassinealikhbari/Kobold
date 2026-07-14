import { fetchText } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, getArrayText, getText, parseRssItems, validRawJob } from './utils.js';

const FEEDS = [
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
];

export const weWorkRemotelyAdapter: SourceAdapter = {
  name: 'weworkremotely',
  async fetchJobs() {
    const settled = await Promise.allSettled(FEEDS.map((url) => fetchText(url)));
    const jobsByUrl = new Map<string, RawJob>();
    const warnings: string[] = [];

    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        warnings.push(`${FEEDS[index]}: ${errorText(result.reason)}`);
        return;
      }

      for (const item of parseRssItems(result.value)) {
        const parsedTitle = splitCompanyAndTitle(getText(item.title) ?? '');
        const location = uniqueStrings([getText(item.region), getText(item.state), getText(item.country)]).join(', ');
        const skills = getText(item.skills)?.split(/\s*,\s*|\s+and\s+/i) ?? [];
        const raw = validRawJob({
          title: parsedTitle.title,
          company: parsedTitle.company,
          location: location || 'Remote worldwide',
          url: getText(item.link) ?? getText(item.guid) ?? '',
          tags: [...getArrayText(item.category), ...skills],
          jobTypes: getArrayText(item.type),
          descriptionHtml: getText(item.description),
          remote: true,
          postedAt: dateToIso(item.pubDate),
        });
        if (raw) jobsByUrl.set(raw.url, raw);
      }
    });

    if (jobsByUrl.size === 0 && settled.every((result) => result.status === 'rejected')) {
      throw new Error(`We Work Remotely feeds failed: ${warnings.join('; ')}`);
    }
    return { jobs: Array.from(jobsByUrl.values()), warnings };
  },
};

export function splitCompanyAndTitle(value: string): { company: string; title: string } {
  const separator = value.indexOf(':');
  if (separator === -1) return { company: '(see listing)', title: value.trim() };
  return {
    company: value.slice(0, separator).trim() || '(see listing)',
    title: value.slice(separator + 1).trim(),
  };
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
