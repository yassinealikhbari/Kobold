import { fetchText } from './http';
import type { RawJob, SourceAdapter } from './types';
import { dateToIso, getText, parseRssItems, splitRoleAtCompany, validRawJob } from './utils';

const FEEDS = ['https://vuejobs.com/feed', 'https://app.vuejobs.com/feed/posts'];

export const vuejobsAdapter: SourceAdapter = {
  name: 'vuejobs',
  async fetchJobs() {
    let lastError: unknown;

    for (const feed of FEEDS) {
      try {
        const xml = await fetchText(feed);
        return parseRssItems(xml)
          .map((item): RawJob | null => {
            const rawTitle = getText(item.title) ?? '';
            const parsedTitle = splitRoleAtCompany(rawTitle);
            const raw = validRawJob({
              title: parsedTitle.title,
              company: parsedTitle.company,
              url: getText(item.link) ?? '',
              descriptionHtml: getText(item.description),
              postedAt: dateToIso(item.pubDate),
              tags: ['vue'],
            });

            return raw;
          })
          .filter(Boolean) as RawJob[];
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('VueJobs feeds failed');
  },
};
