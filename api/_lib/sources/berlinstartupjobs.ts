import { fetchText } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { bestEffortBerlinStartupTitle, dateToIso, getText, parseRssItems, validRawJob } from './utils.js';

export const berlinStartupJobsAdapter: SourceAdapter = {
  name: 'berlinstartupjobs',
  async fetchJobs() {
    const xml = await fetchText('https://berlinstartupjobs.com/engineering/feed/');

    return { jobs: parseRssItems(xml)
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
          tags: ['engineering'],
        });
      })
      .filter(Boolean) as RawJob[] };
  },
};
