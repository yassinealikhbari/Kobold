import { XMLParser } from 'fast-xml-parser';

import type { RawJob } from './types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '#cdata',
});

type RssItem = {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  pubDate?: unknown;
  description?: unknown;
  'content:encoded'?: unknown;
  category?: unknown;
  region?: unknown;
  country?: unknown;
  state?: unknown;
  skills?: unknown;
  type?: unknown;
  'dc:creator'?: unknown;
  'himalayasJobs:companyName'?: unknown;
  'himalayasJobs:locationRestriction'?: unknown;
};

export function parseRssItems(xml: string): RssItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem | RssItem[] } };
    feed?: { entry?: RssItem | RssItem[] };
  };
  const item = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
  return Array.isArray(item) ? item : [item];
}

export function parseJsonLd(html: string): unknown[] {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const values: unknown[] = [];

  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      values.push(...flattenJsonLd(parsed));
    } catch {
      continue;
    }
  }

  return values;
}

export function getText(value: unknown): string | undefined {
  if (typeof value === 'string') return decodeEntities(value).trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#cdata' in value) {
    return getText((value as { '#cdata': unknown })['#cdata']);
  }

  return undefined;
}

export function getArrayText(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(getText).filter(Boolean) as string[];
  const text = getText(value);
  return text ? [text] : [];
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function htmlToText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function truncateRawJob(raw: RawJob): RawJob {
  return {
    ...raw,
    descriptionHtml: truncate(raw.descriptionHtml, 100_000),
    descriptionText: truncate(raw.descriptionText ?? htmlToText(raw.descriptionHtml), 20_000),
  };
}

export function validRawJob(raw: RawJob): RawJob | null {
  if (!raw.title.trim() || !raw.url.trim()) return null;
  return truncateRawJob(raw);
}

export function unixSecondsToIso(value: unknown): string | undefined {
  if (typeof value !== 'number') return undefined;
  return new Date(value * 1000).toISOString();
}

export function dateToIso(value: unknown): string | undefined {
  const text = getText(value);
  if (!text) return undefined;

  const time = Date.parse(text);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

export function splitRoleAtCompany(title: string): { title: string; company: string } {
  const atIndex = title.toLowerCase().lastIndexOf(' at ');
  if (atIndex === -1) return { title, company: '(see listing)' };

  return {
    title: title.slice(0, atIndex).trim(),
    company: title.slice(atIndex + 4).trim() || '(see listing)',
  };
}

export function bestEffortBerlinStartupTitle(title: string): { title: string; company: string } {
  if (title.includes(':')) {
    const [company, ...rest] = title.split(':');
    return { company: company?.trim() || '(see listing)', title: rest.join(':').trim() || title };
  }

  if (title.includes('//')) {
    const [role, company] = title.split('//');
    return { title: role?.trim() || title, company: company?.trim() || '(see listing)' };
  }

  return { title, company: '(see listing)' };
}

export function absoluteUrl(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return undefined;
  }
}

export function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function flattenJsonLd(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== 'object') return [];

  const object = value as Record<string, unknown>;
  const graph = object['@graph'];
  const current = [object];
  return graph ? [...current, ...flattenJsonLd(graph)] : current;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
