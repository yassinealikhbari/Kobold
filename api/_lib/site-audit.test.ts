import { describe, expect, it } from 'vitest';

import { analyzeAuditResponse, auditWebsite, isPrivateIp, normalizeAuditUrl } from './site-audit';

describe('site audit', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '::1', 'fc00::1'])(
    'rejects private IP %s',
    (address) => expect(isPrivateIp(address)).toBe(true),
  );

  it('accepts only public HTTP URL shapes', () => {
    expect(normalizeAuditUrl('https://example.com').toString()).toBe('https://example.com/');
    expect(() => normalizeAuditUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeAuditUrl('https://user:pass@example.com')).toThrow();
  });

  it('detects encoding, viewport, legal links, CMS, and Open Graph', () => {
    const snapshot = analyzeAuditResponse({
      requestedUrl: 'http://example.com/',
      finalUrl: 'https://example.com/',
      httpStatus: 200,
      responseMs: 123,
      headers: new Headers({
        'content-type': 'text/html; charset=UTF-8',
        'last-modified': 'Wed, 01 Jul 2026 10:00:00 GMT',
      }),
      html: `
        <html><head>
          <title>Cavatappi</title>
          <meta name="viewport" content="width=device-width">
          <meta name="generator" content="WordPress 6">
          <meta property="og:title" content="Cavatappi">
        </head><body>
          <a href="/impressum">Impressum</a>
          <a href="/datenschutz">Datenschutz</a>
        </body></html>`,
      pageWeightBytes: 500,
    });
    expect(snapshot).toMatchObject({
      status: 'completed',
      https: true,
      charset: 'utf-8',
      viewport_meta: true,
      cms: 'WordPress',
      has_impressum: true,
      has_datenschutz: true,
      has_open_graph: true,
      page_title: 'Cavatappi',
    });
  });

  it('stores a timeout-style failure rather than throwing', async () => {
    const snapshot = await auditWebsite('https://example.com', {
      validateTarget: async () => undefined,
      fetcher: async () => {
        throw new Error('Timed out');
      },
    });
    expect(snapshot.status).toBe('failed');
    expect(snapshot.error).toContain('Timed out');
  });
});

