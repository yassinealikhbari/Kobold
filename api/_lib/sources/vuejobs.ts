import { fetchText } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import {
  dateToIso,
  decodeEntities,
  getText,
  htmlToText,
  parseRssItems,
  splitRoleAtCompany,
  validRawJob,
} from './utils.js';

const FEEDS = ['https://vuejobs.com/feed', 'https://app.vuejobs.com/feed/posts'];
const LABELED_PARAGRAPH_RE =
  /<p[^>]*>\s*<strong[^>]*>\s*(?:Employer|Location)\s*:?\s*<\/strong>[\s\S]*?<\/p>/gi;

export const vuejobsAdapter: SourceAdapter = {
  name: 'vuejobs',
  async fetchJobs() {
    const settled = await Promise.allSettled(FEEDS.map((feed) => fetchText(feed)));
    const jobsByUrl = new Map<string, RawJob>();
    const warnings: string[] = [];

    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        warnings.push(`${FEEDS[index]}: ${errorText(result.reason)}`);
        return;
      }

      for (const item of parseRssItems(result.value)) {
        const rawTitle = getText(item.title) ?? '';
        const parsedTitle = splitRoleAtCompany(rawTitle);
        const descriptionHtml = getText(item.description);
        const metadata = parseVueJobsDescription(descriptionHtml);
        const raw = validRawJob({
          title: parsedTitle.title,
          company: metadata.company ?? parsedTitle.company,
          location: metadata.location,
          url: getText(item.link) ?? '',
          descriptionHtml: metadata.descriptionHtml,
          descriptionText: htmlToText(metadata.descriptionHtml),
          remote: metadata.location ? /\b(?:remote|worldwide|anywhere)\b/i.test(metadata.location) : undefined,
          postedAt: dateToIso(item.pubDate),
          tags: ['vue'],
        });
        if (raw) jobsByUrl.set(raw.url, preferRicherJob(jobsByUrl.get(raw.url), raw));
      }
    });

    if (jobsByUrl.size === 0 && settled.every((result) => result.status === 'rejected')) {
      throw new Error(`VueJobs feeds failed: ${warnings.join('; ')}`);
    }

    return { jobs: Array.from(jobsByUrl.values()), warnings };
  },
};

export function parseVueJobsDescription(html?: string): {
  company?: string;
  location?: string;
  descriptionHtml?: string;
} {
  if (!html) return {};

  const company = extractLabel(html, 'Employer');
  const location = extractLabel(html, 'Location');
  const descriptionHtml = html.replace(LABELED_PARAGRAPH_RE, '').trim() || undefined;
  return { company, location, descriptionHtml };
}

function extractLabel(html: string, label: string): string | undefined {
  const pattern = new RegExp(`<strong[^>]*>\\s*${label}\\s*:?\\s*</strong>\\s*([^<\\r\\n]+)`, 'i');
  const value = pattern.exec(html)?.[1];
  if (!value) return undefined;
  return decodeEntities(value).replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() || undefined;
}

function preferRicherJob(existing: RawJob | undefined, incoming: RawJob): RawJob {
  if (!existing) return incoming;
  return {
    ...existing,
    company: existing.company === '(see listing)' ? incoming.company : existing.company,
    location: existing.location ?? incoming.location,
    descriptionHtml:
      (incoming.descriptionHtml?.length ?? 0) > (existing.descriptionHtml?.length ?? 0)
        ? incoming.descriptionHtml
        : existing.descriptionHtml,
    descriptionText:
      (incoming.descriptionText?.length ?? 0) > (existing.descriptionText?.length ?? 0)
        ? incoming.descriptionText
        : existing.descriptionText,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
