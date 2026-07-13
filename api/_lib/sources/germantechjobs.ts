import { fetchText } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { arrayify, dateToIso, getArrayText, getText, parseJsonLd, validRawJob } from './utils.js';

const URLS = ['https://germantechjobs.de/jobs/Vue/Berlin', 'https://germantechjobs.de/jobs/Vue/Remote'];

type JobPostingLike = Record<string, unknown>;

export const germanTechJobsAdapter: SourceAdapter = {
  name: 'germantechjobs',
  async fetchJobs() {
    const jobs: RawJob[] = [];

    for (const url of URLS) {
      try {
        const html = await fetchText(url);
        const postings = parseJsonLd(html).filter(isJobPosting);

        for (const posting of postings) {
          const raw = validRawJob({
            title: getText(posting.title) ?? '',
            company: getHiringOrganization(posting.hiringOrganization),
            location: getLocation(posting.jobLocation) ?? (url.includes('/Remote') ? 'Remote Europe' : 'Berlin'),
            url: getText(posting.url) ?? url,
            tags: ['vue'],
            descriptionHtml: getText(posting.description),
            remote: url.includes('/Remote'),
            postedAt: dateToIso(posting.datePosted),
            salaryText: getSalary(posting.baseSalary),
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

function isJobPosting(value: unknown): value is JobPostingLike {
  if (!value || typeof value !== 'object') return false;
  const type = (value as Record<string, unknown>)['@type'];
  return getArrayText(type).some((entry) => /jobposting/i.test(entry));
}

function getHiringOrganization(value: unknown): string {
  if (!value || typeof value !== 'object') return '(see listing)';
  return getText((value as Record<string, unknown>).name) ?? '(see listing)';
}

function getLocation(value: unknown): string | undefined {
  const locations = arrayify(value);
  const parts = locations
    .map((location) => {
      if (!location || typeof location !== 'object') return getText(location);
      const object = location as Record<string, unknown>;
      const address = object.address;
      if (!address || typeof address !== 'object') return getText(object.name);

      const addressObject = address as Record<string, unknown>;
      return [
        getText(addressObject.addressLocality),
        getText(addressObject.addressRegion),
        getText(addressObject.addressCountry),
      ]
        .filter(Boolean)
        .join(', ');
    })
    .filter(Boolean);

  return parts.join(' / ') || undefined;
}

function getSalary(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const object = value as Record<string, unknown>;
  return getText(object.value) ?? getText(object.minValue) ?? undefined;
}
