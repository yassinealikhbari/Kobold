import { HttpError } from './auth.js';

export const TEMPLATE_LANGUAGES = ['de', 'it', 'en'] as const;
export const TEMPLATE_CHANNELS = ['dm', 'email', 'whatsapp', 'in_person'] as const;
export const TEMPLATE_VARIABLES = [
  'contact_first_name',
  'organization_name',
  'district',
  'finding',
] as const;

export function templatePayload(value: unknown, partial = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be an object');
  }
  const body = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const payload: Record<string, unknown> = {};
  readText(body, payload, fields, 'title', 160, partial);
  readText(body, payload, fields, 'body', 10000, partial);

  if ('template_key' in body) {
    const key = String(body.template_key ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)) {
      fields.template_key = 'Use lowercase letters, numbers, underscores, or hyphens.';
    } else payload.template_key = key;
  } else if (!partial) {
    const title = typeof body.title === 'string' ? body.title : '';
    payload.template_key = slugifyTemplateKey(title);
  }

  if ('language' in body) {
    if (!TEMPLATE_LANGUAGES.includes(body.language as (typeof TEMPLATE_LANGUAGES)[number])) {
      fields.language = 'Choose de, it, or en.';
    } else payload.language = body.language;
  } else if (!partial) fields.language = 'Choose a language.';

  if ('channel' in body) {
    if (!TEMPLATE_CHANNELS.includes(body.channel as (typeof TEMPLATE_CHANNELS)[number])) {
      fields.channel = 'Choose a supported channel.';
    } else payload.channel = body.channel;
  } else if (!partial) fields.channel = 'Choose a channel.';

  if (typeof payload.body === 'string') {
    try {
      payload.variables = extractTemplateVariables(payload.body);
    } catch (error) {
      fields.body = error instanceof Error ? error.message : 'Invalid template variables.';
    }
  }

  if (Object.keys(fields).length) {
    throw new HttpError(400, 'Please correct the highlighted fields.', { fields });
  }
  return payload;
}

export function extractTemplateVariables(body: string): string[] {
  const variables = [...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((match) => match[1]!);
  const invalid = variables.find(
    (variable) => !TEMPLATE_VARIABLES.includes(variable as (typeof TEMPLATE_VARIABLES)[number]),
  );
  if (invalid) throw new Error(`Unknown variable: ${invalid}`);
  return [...new Set(variables)];
}

export function slugifyTemplateKey(title: string): string {
  const value = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  if (!value) throw new HttpError(400, 'A title that can form a template key is required');
  return value;
}

function readText(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  fields: Record<string, string>,
  key: string,
  max: number,
  partial: boolean,
) {
  if (!(key in body)) {
    if (!partial) fields[key] = 'This field is required.';
    return;
  }
  const value = typeof body[key] === 'string' ? body[key].trim() : '';
  if (!value) fields[key] = 'This field is required.';
  else if (value.length > max) fields[key] = `Use ${max} characters or fewer.`;
  else payload[key] = value;
}

