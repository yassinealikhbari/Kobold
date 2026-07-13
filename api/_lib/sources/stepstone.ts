import { fetchText } from './http';
import type { RawJob, SourceAdapter } from './types';
import { absoluteUrl, dateToIso, getText, parseJsonLd, validRawJob } from './utils';

const STEPSTONE_URLS = [
  'https://www.stepstone.de/jobs/vue.js/in-berlin?radius=30&action=facet_selected',
  'https://www.stepstone.de/jobs/vue.js/remote',
];

type JobPostingLike = Record<string, unknown>;

export const stepStoneAdapter: SourceAdapter = {
  name: 'stepstone',
  async fetchJobs() {
    const apiKey = process.env.SCRAPERAPI_KEY;
    if (!apiKey) return [];

    const jobs: RawJob[] = [];

    for (const targetUrl of STEPSTONE_URLS) {
      try {
        const html = await fetchText(
          `https://api.scraperapi.com?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(targetUrl)}`,
        );
        const postings = extractPostings(html);

        for (const posting of postings) {
          const raw = validRawJob({
            title: getText(posting.title) ?? '',
            company: getCompany(posting.hiringOrganization),
            location: getLocation(posting.jobLocation),
            url: absoluteUrl(getText(posting.url), 'https://www.stepstone.de') ?? targetUrl,
            tags: ['vue'],
            descriptionHtml: getText(posting.description),
            remote: /remote/i.test(targetUrl),
            postedAt: dateToIso(posting.datePosted),
            salaryText: getText(posting.baseSalary),
          });

          if (raw) jobs.push(raw);
        }
      } catch {
        continue;
      }
    }

    return jobs;
  },
};

function extractPostings(html: string): JobPostingLike[] {
  const jsonLdPostings = parseJsonLd(html).flatMap(findJobPostings);
  if (jsonLdPostings.length > 0) return jsonLdPostings;

  const preloaded = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/i)?.[1];
  if (!preloaded) return [];

  try {
    return findJobPostings(JSON.parse(preloaded) as unknown);
  } catch {
    return [];
  }
}

function findJobPostings(value: unknown): JobPostingLike[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(findJobPostings);

  const object = value as Record<string, unknown>;
  const type = object['@type'];
  const typeText = Array.isArray(type) ? type.join(' ') : getText(type);
  const current = /jobposting/i.test(typeText ?? '') ? [object] : [];

  return [...current, ...Object.values(object).flatMap(findJobPostings)];
}

function getCompany(value: unknown): string {
  if (!value || typeof value !== 'object') return '(see listing)';
  return getText((value as Record<string, unknown>).name) ?? '(see listing)';
}

function getLocation(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return getText(value);
  const object = value as Record<string, unknown>;
  const address = object.address;
  if (!address || typeof address !== 'object') return getText(object.name);

  const addressObject = address as Record<string, unknown>;
  return [getText(addressObject.addressLocality), getText(addressObject.addressCountry)].filter(Boolean).join(', ');
}
