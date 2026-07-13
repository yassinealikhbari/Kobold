import { describe, expect, it } from 'vitest';

import { describeServerError } from './logger.js';

describe('describeServerError', () => {
  it('preserves database error fields from non-Error objects', () => {
    expect(
      describeServerError({
        code: '42703',
        details: null,
        hint: null,
        message: 'column jobs.score_reasons does not exist',
      }),
    ).toMatchObject({
      name: 'Error',
      code: '42703',
      message: 'column jobs.score_reasons does not exist',
    });
  });
});
