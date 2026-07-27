import type { CrmLanguage, MessageTemplate } from '@/types/crm';

export type TemplateVariables = Record<
  'contact_first_name' | 'organization_name' | 'district' | 'finding',
  string | null | undefined
>;

export function renderTemplate(body: string, variables: TemplateVariables): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: keyof TemplateVariables) => {
    const value = variables[key]?.trim();
    return value || `⟦missing:${key}⟧`;
  });
}

export function chooseTemplateVariant(
  templates: MessageTemplate[],
  templateKey: string,
  contactLanguage: CrmLanguage | null,
  organizationLanguage: CrmLanguage | null,
): MessageTemplate | null {
  const variants = templates.filter((item) => item.template_key === templateKey);
  for (const language of [contactLanguage, organizationLanguage, 'de'] as const) {
    if (!language) continue;
    const match = variants.find((item) => item.language === language);
    if (match) return match;
  }
  return variants[0] ?? null;
}

