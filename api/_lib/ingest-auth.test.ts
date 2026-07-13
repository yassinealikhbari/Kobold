import { describe, expect, it } from 'vitest';

import { isAuthorizedIngestCron } from './ingest-auth.js';

describe('ingest cron authorization', () => {
  it('accepts the external cron header for manual source schedules', () => {
    expect(
      isAuthorizedIngestCron({
        expectedSecret: 'secret',
        cronSecret: 'secret',
        allowVercelAuthorization: false,
      }),
    ).toBe(true);
  });

  it('accepts Vercel authorization only for the lifecycle cron path', () => {
    expect(
      isAuthorizedIngestCron({
        expectedSecret: 'secret',
        authorization: 'Bearer secret',
        allowVercelAuthorization: true,
      }),
    ).toBe(true);
    expect(
      isAuthorizedIngestCron({
        expectedSecret: 'secret',
        authorization: 'Bearer secret',
        allowVercelAuthorization: false,
      }),
    ).toBe(false);
  });

  it('rejects missing and invalid secrets', () => {
    expect(isAuthorizedIngestCron({ allowVercelAuthorization: true })).toBe(false);
    expect(
      isAuthorizedIngestCron({ expectedSecret: 'secret', cronSecret: 'wrong', allowVercelAuthorization: false }),
    ).toBe(false);
  });
});
