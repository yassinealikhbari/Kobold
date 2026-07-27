import { describe, expect, it } from 'vitest';

import { extractTemplateVariables, slugifyTemplateKey, templatePayload } from './message-templates';

describe('message template validation', () => {
  it('extracts supported placeholders without duplicates', () => {
    expect(
      extractTemplateVariables('Hi {{contact_first_name}} from {{organization_name}} {{contact_first_name}}'),
    ).toEqual(['contact_first_name', 'organization_name']);
  });

  it('rejects unknown placeholders', () => {
    expect(() => extractTemplateVariables('Hi {{unknown}}')).toThrow('Unknown variable');
  });

  it('creates a stable key from a title', () => {
    expect(slugifyTemplateKey('Café – First Visit')).toBe('cafe_first_visit');
  });

  it('normalizes a complete template', () => {
    expect(
      templatePayload({
        title: 'First visit',
        channel: 'dm',
        language: 'it',
        body: 'Ciao {{contact_first_name}}',
      }),
    ).toEqual({
      title: 'First visit',
      template_key: 'first_visit',
      channel: 'dm',
      language: 'it',
      body: 'Ciao {{contact_first_name}}',
      variables: ['contact_first_name'],
    });
  });
});

