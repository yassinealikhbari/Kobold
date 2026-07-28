import { describe, expect, it } from 'vitest';

import { buildMailtoUrl } from './mailto';

describe('buildMailtoUrl', () => {
  it('builds a mailto link with an encoded subject and body', () => {
    const url = buildMailtoUrl('owner@example.de', 'Quick fix for your site', 'Hi there,\n\nRegards');
    expect(url).toBe(
      'mailto:owner%40example.de?subject=Quick%20fix%20for%20your%20site&body=Hi%20there%2C%0A%0ARegards',
    );
  });

  it('omits the query string when subject and body are both empty', () => {
    expect(buildMailtoUrl('owner@example.de', '', '')).toBe('mailto:owner%40example.de');
  });

  it('trims the recipient address', () => {
    expect(buildMailtoUrl('  owner@example.de  ', '', '')).toBe('mailto:owner%40example.de');
  });
});
