import { getSupabase } from './db.js';

export type CandidateProfile = {
  id: 1;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  summary: string | null;
  skills: string[];
  languages: Array<{ lang: string; level: string }>;
  work_history: Array<{ company: string; role: string; from: string; to: string; highlights: string[] }>;
  experience_years: number;
  cv_path: string | null;
  updated_at: string;
};

export async function getOrCreateProfile(): Promise<CandidateProfile> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profile').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return normalizeProfile(data as Partial<CandidateProfile>);

  const { data: inserted, error: insertError } = await supabase.from('profile').insert({ id: 1 }).select('*').single();
  if (insertError) throw insertError;
  return normalizeProfile(inserted as Partial<CandidateProfile>);
}

export function normalizeProfile(value: Partial<CandidateProfile>): CandidateProfile {
  return {
    id: 1,
    full_name: value.full_name ?? null,
    email: value.email ?? null,
    phone: value.phone ?? null,
    location: value.location ?? null,
    linkedin: value.linkedin ?? null,
    github: value.github ?? null,
    portfolio: value.portfolio ?? null,
    summary: value.summary ?? null,
    skills: Array.isArray(value.skills) ? value.skills : [],
    languages: Array.isArray(value.languages) ? value.languages : [],
    work_history: Array.isArray(value.work_history) ? value.work_history : [],
    experience_years: normalizeExperienceYears(value.experience_years),
    cv_path: value.cv_path ?? null,
    updated_at: value.updated_at ?? new Date().toISOString(),
  };
}

export function profileUpdatePayload(body: Partial<CandidateProfile>): Record<string, unknown> {
  return {
    id: 1,
    full_name: nullableString(body.full_name),
    email: nullableString(body.email),
    phone: nullableString(body.phone),
    location: nullableString(body.location),
    linkedin: nullableString(body.linkedin),
    github: nullableString(body.github),
    portfolio: nullableString(body.portfolio),
    summary: nullableString(body.summary),
    skills: Array.isArray(body.skills) ? body.skills.filter(Boolean) : [],
    languages: Array.isArray(body.languages) ? body.languages : [],
    work_history: Array.isArray(body.work_history) ? body.work_history : [],
    experience_years: normalizeExperienceYears(body.experience_years),
    updated_at: new Date().toISOString(),
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeExperienceYears(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 5.5;
  return Math.min(60, Math.max(0, Math.round(numeric * 2) / 2));
}
