import { describe, expect, it } from 'vitest';

import { chooseTemplateVariant, renderTemplate } from './templates';
import type { MessageTemplate } from '@/types/crm';

describe('outreach templates', () => {
  it('marks missing variables visibly', () => {
    expect(
      renderTemplate('Hi {{contact_first_name}} at {{organization_name}}', {
        contact_first_name: 'Giulia',
        organization_name: null,
        district: null,
        finding: null,
      }),
    ).toBe('Hi Giulia at ⟦missing:organization_name⟧');
  });

  it('falls back contact, organization, then German', () => {
    const templates = [variant('de'), variant('it'), variant('en')];
    expect(chooseTemplateVariant(templates, 'intro', 'it', 'de')?.language).toBe('it');
    expect(chooseTemplateVariant(templates, 'intro', null, 'en')?.language).toBe('en');
    expect(chooseTemplateVariant([variant('de')], 'intro', null, null)?.language).toBe('de');
  });
});

function variant(language: MessageTemplate['language']): MessageTemplate {
  return {
    id: language,
    template_key: 'intro',
    title: 'Intro',
    channel: 'dm',
    language,
    body: 'Hello',
    variables: [],
    archived_at: null,
    created_at: '',
    updated_at: '',
  };
}

