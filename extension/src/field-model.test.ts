import { describe, expect, it } from 'vitest';

import { decideField, detectAts, type FieldDescriptor } from './field-model';
import type { ExtensionProfile } from './profile';

const profile: ExtensionProfile = {
  fullName: 'Yassine Alikhbari',
  firstName: 'Yassine',
  lastName: 'Alikhbari',
  email: 'yassine@example.com',
  phone: '+49 170 1234567',
  location: 'Berlin, Germany',
  country: 'Germany',
  linkedin: 'https://linkedin.com/in/yassine',
  github: 'https://github.com/yassine',
  portfolio: 'https://yassine.dev',
  summary: 'Frontend engineer focused on Vue and TypeScript.',
  experienceYears: 5.5,
  currentCompany: 'Example GmbH',
  currentRole: 'Frontend Engineer',
};

describe('ATS field decisions', () => {
  it('recognizes Greenhouse, Lever, and Ashby aliases', () => {
    expect(decideField(field({ ats: 'greenhouse', id: 'first_name' }), profile)).toMatchObject({
      action: 'fill',
      field: 'firstName',
      value: 'Yassine',
    });
    expect(decideField(field({ ats: 'lever', name: 'urls[LinkedIn]' }), profile)).toMatchObject({
      action: 'fill',
      field: 'linkedin',
    });
    expect(decideField(field({ ats: 'ashby', name: 'candidateEmail' }), profile)).toMatchObject({
      action: 'fill',
      field: 'email',
    });
  });

  it('uses generic labels and autocomplete attributes as a fallback', () => {
    expect(decideField(field({ autocomplete: 'family-name' }), profile)).toMatchObject({
      action: 'fill',
      value: 'Alikhbari',
    });
    expect(decideField(field({ tag: 'textarea', label: 'Professional summary' }), profile)).toMatchObject({
      action: 'fill',
      field: 'summary',
    });
  });

  it('matches country selects by option value', () => {
    expect(
      decideField(
        field({
          tag: 'select',
          label: 'Country',
          options: [
            { value: '', label: 'Select' },
            { value: 'DE', label: 'Germany' },
          ],
        }),
        profile,
      ),
    ).toMatchObject({ action: 'select', field: 'country', value: 'DE' });
  });

  it.each([
    { type: 'file', label: 'Resume upload' },
    { tag: 'textarea' as const, label: 'Cover letter' },
    { label: 'Salary expectation' },
    { label: 'Will you require visa sponsorship?' },
    { label: 'Gender identity' },
  ])('leaves sensitive field "$label" for manual review', (patch) => {
    expect(decideField(field(patch), profile).action).toBe('manual');
  });
});

describe('ATS detection', () => {
  it('detects supported hosts and keeps a generic fallback', () => {
    expect(detectAts('boards.greenhouse.io')).toBe('greenhouse');
    expect(detectAts('jobs.lever.co')).toBe('lever');
    expect(detectAts('jobs.ashbyhq.com')).toBe('ashby');
    expect(detectAts('careers.example.com')).toBe('generic');
  });
});

function field(patch: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    ats: 'generic',
    tag: 'input',
    type: 'text',
    id: '',
    name: '',
    label: '',
    placeholder: '',
    autocomplete: '',
    options: [],
    ...patch,
  };
}
