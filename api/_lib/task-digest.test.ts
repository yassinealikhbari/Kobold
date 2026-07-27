import { describe, expect, it } from 'vitest';

import { berlinDate, buildTaskDigest } from './task-digest';

describe('task digest', () => {
  it('separates overdue and due-today work', () => {
    const text = buildTaskDigest(
      [
        { title: 'Old task', subject_label: 'Cavatappi', mode: 'freelance', due_at: '2026-07-10T08:00:00Z' },
        { title: 'Interview prep', subject_label: 'Example GmbH', mode: 'jobs', due_at: '2026-07-10T18:00:00Z' },
      ],
      new Date('2026-07-10T12:00:00Z'),
    );
    expect(text).toContain('OVERDUE');
    expect(text).toContain('DUE TODAY');
    expect(text).toContain('Freelance - Cavatappi');
    expect(text).toContain('Job Hunt - Example GmbH');
  });

  it('uses the Berlin calendar date', () => {
    expect(berlinDate(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
  });
});

