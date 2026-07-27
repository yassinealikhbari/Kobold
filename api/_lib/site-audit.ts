import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { HttpError } from './auth.js';

const MAX_PAGE_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

export type AuditSnapshot = {
  requested_url: string;
  final_url: string | null;
  status: 'completed' | 'failed';
  http_status: number | null;
  https: boolean | null;
  response_ms: number | null;
  charset: string | null;
  mojibake_detected: boolean | null;
  viewport_meta: boolean | null;
  page_weight_bytes: number | null;
  generator: string | null;
  cms: string | null;
  has_impressum: boolean | null;
  has_datenschutz: boolean | null;
  has_open_graph: boolean | null;
  last_modified: string | null;
  page_title: string | null;
  error: string | null;
};

export async function auditWebsite(
  rawUrl: string,
  dependencies: {
    fetcher?: typeof fetch;
    validateTarget?: (url: URL) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<AuditSnapshot> {
  const requested = normalizeAuditUrl(rawUrl);
  const fetcher = dependencies.fetcher ?? fetch;
  const validateTarget = dependencies.validateTarget ?? validatePublicTarget;
  const now = dependencies.now ?? Date.now;

  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const started = now();
        const { response, finalUrl } = await fetchWithSafeRedirects(requested, fetcher, validateTarget);
        if (response.status >= 500 && attempt === 0) continue;
        const lengthHeader = Number(response.headers.get('content-length') ?? 0);
        if (lengthHeader > MAX_PAGE_BYTES) throw new Error('Page is larger than the 2 MB audit limit');
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_PAGE_BYTES) throw new Error('Page is larger than the 2 MB audit limit');
        const html = new TextDecoder().decode(buffer);
        return analyzeAuditResponse({
          requestedUrl: requested.toString(),
          finalUrl: finalUrl.toString(),
          httpStatus: response.status,
          responseMs: Math.max(0, now() - started),
          headers: response.headers,
          html,
          pageWeightBytes: buffer.byteLength,
        });
      } catch (error) {
        lastError = error;
        if (attempt === 0) continue;
      }
    }
    throw lastError;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return {
      requested_url: requested.toString(),
      final_url: null,
      status: 'failed',
      http_status: null,
      https: requested.protocol === 'https:',
      response_ms: null,
      charset: null,
      mojibake_detected: null,
      viewport_meta: null,
      page_weight_bytes: null,
      generator: null,
      cms: null,
      has_impressum: null,
      has_datenschutz: null,
      has_open_graph: null,
      last_modified: null,
      page_title: null,
      error: error instanceof Error ? error.message.slice(0, 1000) : 'Audit failed',
    };
  }
}

export function normalizeAuditUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) throw new HttpError(400, 'Enter a valid website URL');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, 'Enter a complete http:// or https:// URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(400, 'Only public http:// and https:// URLs are allowed');
  }
  return url;
}

export async function validatePublicTarget(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0'
  ) {
    throw new HttpError(400, 'Private network URLs cannot be audited');
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new HttpError(400, 'Private network URLs cannot be audited');
  }
}

export function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.includes(':')) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return true;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 168) ||
    first! >= 224
  );
}

export function analyzeAuditResponse(input: {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  responseMs: number;
  headers: Pick<Headers, 'get'>;
  html: string;
  pageWeightBytes: number;
}): AuditSnapshot {
  const charset =
    input.headers.get('content-type')?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase() ??
    input.html.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s/>]+)/i)?.[1]?.toLowerCase() ??
    null;
  const generator =
    decodeText(input.html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1]) ??
    decodeText(input.html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i)?.[1]) ??
    null;
  const title = decodeText(input.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ?? null;
  return {
    requested_url: input.requestedUrl,
    final_url: input.finalUrl,
    status: 'completed',
    http_status: input.httpStatus,
    https: new URL(input.finalUrl).protocol === 'https:',
    response_ms: input.responseMs,
    charset,
    mojibake_detected: /(?:Ã.|â(?:€|™|€œ|€œ)|�)/.test(input.html),
    viewport_meta: /<meta[^>]+name=["']viewport["']/i.test(input.html),
    page_weight_bytes: input.pageWeightBytes,
    generator,
    cms: detectCms(input.html, generator),
    has_impressum: /<a[^>]+href=["'][^"']*(?:impressum|imprint)[^"']*["']/i.test(input.html),
    has_datenschutz: /<a[^>]+href=["'][^"']*(?:datenschutz|privacy)[^"']*["']/i.test(input.html),
    has_open_graph: /<meta[^>]+property=["']og:/i.test(input.html),
    last_modified: input.headers.get('last-modified'),
    page_title: title?.slice(0, 300) ?? null,
    error: null,
  };
}

async function fetchWithSafeRedirects(
  initial: URL,
  fetcher: typeof fetch,
  validateTarget: (url: URL) => Promise<void>,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = initial;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await validateTarget(current);
    const response = await fetcher(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'KOBOLD-Site-Audit/1.0' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current };
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: current };
    current = normalizeAuditUrl(new URL(location, current).toString());
  }
  throw new Error('Too many redirects');
}

function detectCms(html: string, generator: string | null): string | null {
  const haystack = `${generator ?? ''} ${html.slice(0, 100_000)}`;
  if (/wp-content|wordpress/i.test(haystack)) return 'WordPress';
  if (/wixstatic|wix\.com/i.test(haystack)) return 'Wix';
  if (/squarespace/i.test(haystack)) return 'Squarespace';
  if (/shopify/i.test(haystack)) return 'Shopify';
  if (/webflow/i.test(haystack)) return 'Webflow';
  return generator;
}

function decodeText(value: string | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
