import { fetchText } from './http.js';
import type { RawJob, SourceAdapter } from './types.js';
import { dateToIso, getArrayText, getText, parseRssItems, validRawJob } from './utils.js';

const FEED = 'https://himalayas.app/jobs/rss';

export const himalayasAdapter: SourceAdapter = {
  name: 'himalayas',
  async fetchJobs() {
    const xml = await fetchText(FEED);
    return {
      jobs: parseRssItems(xml)
        .map((item): RawJob | null => {
          const restrictions = getArrayText(item['himalayasJobs:locationRestriction']);
          return validRawJob({
            title: getText(item.title) ?? '',
            company: getText(item['himalayasJobs:companyName']) ?? '(see listing)',
            location: restrictions.length > 0 ? `Remote - ${restrictions.join(' / ')}` : 'Remote worldwide',
            url: getText(item.link) ?? getText(item.guid) ?? '',
            tags: getArrayText(item.category),
            descriptionHtml: getText(item['content:encoded']) ?? getText(item.description),
            remote: true,
            postedAt: dateToIso(item.pubDate),
          });
        })
        .filter(Boolean) as RawJob[],
    };
  },
};
