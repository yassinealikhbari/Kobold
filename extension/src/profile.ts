export type ExtensionProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  experienceYears: number;
  currentCompany: string;
  currentRole: string;
};

export function toExtensionProfile(input: unknown): ExtensionProfile {
  if (!isRecord(input)) throw new Error('KOBOLD returned an invalid profile');

  const fullName = stringValue(input.full_name);
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const workHistory = Array.isArray(input.work_history) ? input.work_history.filter(isRecord) : [];
  const currentWork = workHistory[0];
  const location = stringValue(input.location);

  return {
    fullName,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    email: stringValue(input.email),
    phone: stringValue(input.phone),
    location,
    country: location.split(',').at(-1)?.trim() ?? '',
    linkedin: stringValue(input.linkedin),
    github: stringValue(input.github),
    portfolio: stringValue(input.portfolio),
    summary: stringValue(input.summary),
    experienceYears: numberValue(input.experience_years, 5.5),
    currentCompany: stringValue(currentWork?.company),
    currentRole: stringValue(currentWork?.role),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
