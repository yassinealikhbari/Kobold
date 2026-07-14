import type { ExtensionProfile } from './profile';

export type AtsName = 'greenhouse' | 'lever' | 'ashby' | 'generic';
export type FillField =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'location'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'summary'
  | 'experienceYears'
  | 'currentCompany'
  | 'currentRole';

export type FieldOption = {
  value: string;
  label: string;
};

export type FieldDescriptor = {
  ats: AtsName;
  tag: 'input' | 'textarea' | 'select';
  type: string;
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autocomplete: string;
  options: FieldOption[];
};

export type FillDecision =
  | { action: 'fill' | 'select'; field: FillField; value: string }
  | { action: 'manual'; reason: string }
  | { action: 'skip'; reason: string };

const MANUAL_RE =
  /\b(?:cover letter|resume|curriculum vitae|\bcv\b|salary|compensation|pay expectation|work authorization|legally authorized|sponsorship|visa|gender|sex|race|ethnicity|disability|veteran|date of birth|social security|passport|nationality|pronouns?)\b/i;
const UNSUPPORTED_TYPE_RE = /^(?:hidden|submit|button|reset|image|checkbox|radio|password)$/i;

const ATS_ALIASES: Record<Exclude<AtsName, 'generic'>, Array<[RegExp, FillField]>> = {
  greenhouse: [
    [/^(?:first_name|first name)$/i, 'firstName'],
    [/^(?:last_name|last name)$/i, 'lastName'],
    [/^(?:email)$/i, 'email'],
    [/^(?:phone)$/i, 'phone'],
    [/^(?:job_application_location|location)$/i, 'location'],
    [/linkedin/i, 'linkedin'],
    [/github/i, 'github'],
    [/(?:portfolio|website)/i, 'portfolio'],
  ],
  lever: [
    [/^(?:name|candidate name)$/i, 'fullName'],
    [/email/i, 'email'],
    [/phone/i, 'phone'],
    [/(?:org|company)/i, 'currentCompany'],
    [/linkedin/i, 'linkedin'],
    [/github/i, 'github'],
    [/(?:portfolio|website)/i, 'portfolio'],
  ],
  ashby: [
    [/(?:candidate.?name|full.?name)/i, 'fullName'],
    [/(?:candidate.?email|email)/i, 'email'],
    [/(?:candidate.?phone|phone)/i, 'phone'],
    [/(?:linkedin)/i, 'linkedin'],
    [/(?:github)/i, 'github'],
    [/(?:website|portfolio)/i, 'portfolio'],
  ],
};

export function detectAts(hostname: string): AtsName {
  if (/greenhouse\.io$|greenhouse\.io\b/i.test(hostname)) return 'greenhouse';
  if (/lever\.co$|lever\.co\b/i.test(hostname)) return 'lever';
  if (/ashbyhq\.com$|ashbyhq\.com\b/i.test(hostname)) return 'ashby';
  return 'generic';
}

export function decideField(field: FieldDescriptor, profile: ExtensionProfile): FillDecision {
  if (field.type.toLowerCase() === 'file') return { action: 'manual', reason: 'Attach the CV manually' };
  if (UNSUPPORTED_TYPE_RE.test(field.type)) return { action: 'skip', reason: 'Unsupported control type' };

  const searchable = normalized(
    [field.id, field.name, field.label, field.placeholder, field.autocomplete].filter(Boolean).join(' '),
  );
  if (MANUAL_RE.test(searchable)) return { action: 'manual', reason: 'Review this field manually' };

  const key = atsAlias(field) ?? autocompleteAlias(field.autocomplete) ?? genericAlias(searchable, field.tag);
  if (!key) return { action: 'skip', reason: 'Field is not recognized' };

  const value = profileValue(profile, key);
  if (!value) return { action: 'skip', reason: `Profile has no ${key} value` };
  if (field.tag !== 'select') return { action: 'fill', field: key, value };

  const option = findOption(field.options, value, key);
  return option
    ? { action: 'select', field: key, value: option.value }
    : { action: 'manual', reason: `No matching option for ${key}` };
}

function atsAlias(field: FieldDescriptor): FillField | null {
  if (field.ats === 'generic') return null;
  const value = `${field.id} ${field.name} ${field.label}`.trim();
  for (const [pattern, key] of ATS_ALIASES[field.ats]) {
    if (pattern.test(value)) return key;
  }
  return null;
}

function autocompleteAlias(value: string): FillField | null {
  const autocomplete: Record<string, FillField> = {
    name: 'fullName',
    'given-name': 'firstName',
    'family-name': 'lastName',
    email: 'email',
    tel: 'phone',
    country: 'country',
    'country-name': 'country',
    'address-level2': 'location',
  };
  return autocomplete[value.trim().toLowerCase()] ?? null;
}

function genericAlias(searchable: string, tag: FieldDescriptor['tag']): FillField | null {
  if (/\b(?:linkedin|linked in)\b/.test(searchable)) return 'linkedin';
  if (/\bgithub\b/.test(searchable)) return 'github';
  if (/\b(?:portfolio|personal website|personal site)\b/.test(searchable)) return 'portfolio';
  if (/\b(?:first|given) name\b/.test(searchable)) return 'firstName';
  if (/\b(?:last name|family name|surname)\b/.test(searchable)) return 'lastName';
  if (/\b(?:full name|legal name|candidate name|your name)\b/.test(searchable)) return 'fullName';
  if (/\b(?:email|e mail)\b/.test(searchable)) return 'email';
  if (/\b(?:phone|mobile|telephone)\b/.test(searchable)) return 'phone';
  if (/\b(?:years? of experience|professional experience years?)\b/.test(searchable)) return 'experienceYears';
  if (/\b(?:current company|current employer|organization)\b/.test(searchable)) return 'currentCompany';
  if (/\b(?:current title|current role|job title)\b/.test(searchable)) return 'currentRole';
  if (/\bcountry\b/.test(searchable)) return 'country';
  if (/\b(?:current location|location|city)\b/.test(searchable)) return 'location';
  if (tag === 'textarea' && /\b(?:professional summary|profile summary|about you|biography|bio)\b/.test(searchable)) {
    return 'summary';
  }
  if (/\b(?:website|url)\b/.test(searchable)) return 'portfolio';
  return null;
}

function profileValue(profile: ExtensionProfile, key: FillField): string {
  if (key === 'experienceYears') return String(profile.experienceYears);
  return profile[key];
}

function findOption(options: FieldOption[], value: string, key: FillField): FieldOption | null {
  const target = normalized(value);
  const countryCode = key === 'country' && /\bgermany\b/i.test(value) ? 'de' : '';
  return (
    options.find((option) => normalized(option.label) === target || normalized(option.value) === target) ??
    options.find((option) => countryCode && normalized(option.value) === countryCode) ??
    options.find((option) => normalized(option.label).includes(target) || target.includes(normalized(option.label))) ??
    null
  );
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
