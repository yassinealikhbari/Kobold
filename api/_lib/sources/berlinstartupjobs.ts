import { fetchText } from './http';
import type { RawJob, SourceAdapter } from './types';
import { bestEffortBerlinStartupTitle, dateToIso, getText, parseRssItems, validRawJob } from './utils';

export const berlinStartupJobsAdapter: SourceAdapter = {
  name: 'berlinstartupjobs',
  async fetchJobs() {
    const xml = await fetchText('https://berlinstartupjobs.com/?s=vue&feed=rss2');

    return parseRssItems(xml)
      .map((item): RawJob | null => {
        const rawTitle = getText(item.title) ?? '';
        const parsedTitle = bestEffortBerlinStartupTitle(rawTitle);

        return validRawJob({
          title: parsedTitle.title,
          company: parsedTitle.company,
          location: 'Berlin',
          url: getText(item.link) ?? '',
          descriptionHtml: getText(item.description),
          postedAt: dateToIso(item.pubDate),
          tags: ['vue'],
        });
      })
      .filter(Boolean) as RawJob[];
  },
};
