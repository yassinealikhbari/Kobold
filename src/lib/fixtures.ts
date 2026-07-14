import type { Application, ApplicationStatus } from '@/types/applications';
import type { CandidateProfile } from '@/types/profile';
import type { IngestRun, Job, SourceCoverage } from '@/types/jobs';

type FixtureOptions = {
  method?: string;
  body?: unknown;
};

type FixtureApplication = Application;

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

const fixtureJobs: Job[] = [
  {
    id: 'fixture-job-1',
    title: 'Senior Vue.js Engineer',
    company: 'Northstar Labs',
    role_family: 'frontend',
    location: 'Berlin, Germany',
    workplace: 'hybrid',
    url: 'https://example.com/jobs/vue-engineer',
    apply_url: 'https://example.com/jobs/vue-engineer/apply',
    ats: 'greenhouse',
    sources: ['vuejobs'],
    source_listings: [
      {
        source: 'vuejobs',
        url: 'https://example.com/jobs/vue-engineer',
        apply_url: 'https://example.com/jobs/vue-engineer/apply',
      },
    ],
    tags: ['Vue.js', 'TypeScript', 'Nuxt'],
    technologies: ['vue', 'nuxt'],
    employment_types: ['full-time'],
    description_html: '<p>Build a product with Vue.js, Nuxt, and TypeScript.</p>',
    description_text: 'Build a product with Vue.js, Nuxt, and TypeScript.',
    seniority: 'senior',
    german_required: false,
    salary_text: 'EUR 70,000 - 85,000',
    score: 8,
    score_reasons: ['Vue or Nuxt in title', 'Vue or Nuxt tag', 'Berlin location', 'TypeScript', 'Nuxt', 'Salary listed'],
    fit: {
      label: 'strong',
      score: 92,
      reasons: ['Role aligns with frontend experience', 'Profile evidence for Vue and Nuxt', 'Relevant skills: TypeScript, Pinia'],
      risks: [],
      matched_skills: ['Vue', 'Nuxt', 'TypeScript', 'Pinia'],
      requested_skills: ['Vue', 'Nuxt', 'TypeScript', 'Pinia'],
    },
    eligibility_warnings: [],
    profile_eligible: true,
    posted_at: hoursAgo(5),
    first_seen_at: hoursAgo(5),
    last_seen_at: hoursAgo(1),
    status: 'active',
    application: null,
  },
  {
    id: 'fixture-job-2',
    title: 'Frontend Engineer, Vue',
    company: 'Mosaic Cloud',
    role_family: 'frontend',
    location: 'Remote - Europe',
    workplace: 'remote',
    url: 'https://example.com/jobs/frontend-engineer',
    apply_url: null,
    ats: null,
    sources: ['workingnomads', 'remoteok'],
    source_listings: [
      {
        source: 'workingnomads',
        url: 'https://example.com/jobs/frontend-engineer',
        apply_url: null,
      },
    ],
    tags: ['Vue', 'TypeScript'],
    technologies: ['vue'],
    employment_types: ['full-time'],
    description_html: '<p>Help shape a remote-first developer platform.</p>',
    description_text: 'Help shape a remote-first developer platform.',
    seniority: 'mid',
    german_required: false,
    salary_text: null,
    score: 7,
    score_reasons: ['Vue or Nuxt in title', 'Vue or Nuxt tag', 'Remote Europe', 'TypeScript', 'Mid-level scope'],
    fit: {
      label: 'strong',
      score: 84,
      reasons: ['Role aligns with frontend experience', 'Profile evidence for Vue', 'Relevant skills: TypeScript'],
      risks: ['Verify experience with GraphQL'],
      matched_skills: ['Vue', 'TypeScript'],
      requested_skills: ['Vue', 'TypeScript', 'GraphQL'],
    },
    eligibility_warnings: [],
    profile_eligible: true,
    posted_at: hoursAgo(20),
    first_seen_at: hoursAgo(20),
    last_seen_at: hoursAgo(2),
    status: 'active',
    application: null,
  },
  {
    id: 'fixture-job-3',
    title: 'Vue Developer',
    company: 'Orbit Commerce',
    role_family: 'frontend',
    location: 'Remote',
    workplace: 'remote',
    url: 'https://example.com/jobs/vue-developer',
    apply_url: null,
    ats: 'lever',
    sources: ['arbeitnow'],
    source_listings: [
      { source: 'arbeitnow', url: 'https://example.com/jobs/vue-developer', apply_url: null },
    ],
    tags: ['Vue.js'],
    technologies: ['vue'],
    employment_types: ['unknown'],
    description_html: '<p>Maintain a Vue.js storefront.</p>',
    description_text: 'Maintain a Vue.js storefront.',
    seniority: 'unknown',
    german_required: false,
    salary_text: null,
    score: 2,
    score_reasons: ['Vue or Nuxt in title', 'Location needs verification'],
    fit: {
      label: 'possible',
      score: 63,
      reasons: ['Role aligns with frontend experience', 'Profile evidence for Vue'],
      risks: ['Confirm that remote work is available from Germany', 'Confirm the expected seniority'],
      matched_skills: ['Vue'],
      requested_skills: ['Vue'],
    },
    eligibility_warnings: ['remote-region-unverified', 'seniority-unverified', 'employment-type-unverified'],
    profile_eligible: true,
    posted_at: hoursAgo(42),
    first_seen_at: hoursAgo(42),
    last_seen_at: hoursAgo(3),
    status: 'active',
    application: null,
  },
  {
    id: 'fixture-job-4',
    title: 'Vue.js Engineer',
    company: 'Archive Systems',
    role_family: 'frontend',
    location: 'Berlin, Germany',
    workplace: 'onsite',
    url: 'https://example.com/jobs/archive-vue',
    apply_url: null,
    ats: null,
    sources: ['berlinstartupjobs'],
    source_listings: [
      { source: 'berlinstartupjobs', url: 'https://example.com/jobs/archive-vue', apply_url: null },
    ],
    tags: ['Vue.js'],
    technologies: ['vue'],
    employment_types: ['full-time'],
    description_html: '<p>A previously listed Berlin role.</p>',
    description_text: 'A previously listed Berlin role.',
    seniority: 'mid',
    german_required: false,
    salary_text: null,
    score: 6,
    score_reasons: ['Vue or Nuxt in title', 'Vue or Nuxt tag', 'Berlin location', 'Mid-level scope'],
    fit: {
      label: 'possible',
      score: 68,
      reasons: ['Role aligns with frontend experience', 'Profile evidence for Vue'],
      risks: ['Verify experience with AWS'],
      matched_skills: ['Vue'],
      requested_skills: ['Vue', 'AWS'],
    },
    eligibility_warnings: [],
    profile_eligible: true,
    posted_at: hoursAgo(220),
    first_seen_at: hoursAgo(220),
    last_seen_at: hoursAgo(220),
    status: 'stale',
    application: null,
  },
  {
    id: 'fixture-job-5',
    title: 'Staff Vue Platform Architect',
    company: 'GlobalWorks',
    role_family: null,
    location: 'Toronto, Canada',
    workplace: 'onsite',
    url: 'https://example.com/jobs/staff-vue-platform-architect',
    apply_url: null,
    ats: 'ashby',
    sources: ['vuejobs'],
    source_listings: [
      { source: 'vuejobs', url: 'https://example.com/jobs/staff-vue-platform-architect', apply_url: null },
    ],
    tags: ['Vue.js', 'Platform'],
    technologies: ['vue'],
    employment_types: ['full-time'],
    description_html: '<p>Lead architecture for a Vue.js platform in Toronto.</p>',
    description_text: 'Lead architecture for a Vue.js platform in Toronto.',
    seniority: 'unknown',
    german_required: false,
    salary_text: null,
    score: 3,
    score_reasons: ['Vue or Nuxt tag'],
    fit: {
      label: 'stretch',
      score: 38,
      reasons: ['Profile evidence for Vue'],
      risks: ['Outside target profile: seniority out of scope', 'Outside target profile: onsite outside Germany'],
      matched_skills: ['Vue'],
      requested_skills: ['Vue'],
    },
    eligibility_warnings: [
      'outside-profile-seniority-out-of-scope',
      'outside-profile-onsite-outside-germany',
    ],
    profile_eligible: false,
    posted_at: hoursAgo(10),
    first_seen_at: hoursAgo(10),
    last_seen_at: hoursAgo(1),
    status: 'active',
    application: null,
  },
];

const fixtureApplications: FixtureApplication[] = [];

let fixtureProfile: CandidateProfile = {
  id: 1,
  full_name: 'Alex Example',
  email: 'alex@example.test',
  phone: '+49 30 1234567',
  location: 'Berlin, Germany',
  linkedin: 'https://linkedin.com/in/alex-example',
  github: 'https://github.com/alex-example',
  portfolio: 'https://alex-example.test',
  summary: 'Frontend engineer focused on Vue.js, TypeScript, and practical product delivery.',
  skills: ['Vue.js', 'Nuxt', 'TypeScript', 'Pinia'],
  languages: [{ lang: 'English', level: 'Fluent' }],
  work_history: [
    {
      company: 'Example Studio',
      role: 'Frontend Engineer',
      from: '2022',
      to: 'Present',
      highlights: ['Built and maintained Vue.js product experiences.'],
    },
  ],
  experience_years: 5.5,
  cv_path: 'fixture-cv.pdf',
  updated_at: hoursAgo(1),
};

let fixtureSettings = {
  id: 1 as const,
  notify_enabled: false,
  min_score_notify: 3,
  updated_at: hoursAgo(1),
};

const fixtureRuns: IngestRun[] = [
  {
    id: 'fixture-run-1',
    source: 'vuejobs',
    started_at: hoursAgo(1),
    finished_at: hoursAgo(1),
    found: 231,
    matched: 12,
    inserted: 2,
    error: null,
  },
  {
    id: 'fixture-run-2',
    source: 'arbeitnow',
    started_at: hoursAgo(2),
    finished_at: hoursAgo(2),
    found: 18,
    matched: 3,
    inserted: 1,
    error: null,
  },
];

const fixtureCoverage: SourceCoverage[] = [
  {
    source: 'vuejobs',
    status: 'ok',
    fetched: 236,
    parsed: 236,
    eligible: 1,
    returned: 2,
    duplicates: 0,
    excluded: { 'onsite-outside-germany': 130 },
    outside_profile: { 'seniority-out-of-scope': 1, 'onsite-outside-germany': 1 },
    duration_ms: 412,
    cache_hit: true,
    warnings: [],
  },
  {
    source: 'workingnomads',
    status: 'ok',
    fetched: 30,
    parsed: 30,
    eligible: 1,
    returned: 1,
    duplicates: 0,
    excluded: { 'role-family-mismatch': 23 },
    outside_profile: {},
    duration_ms: 522,
    cache_hit: true,
    warnings: [],
  },
  {
    source: 'arbeitnow',
    status: 'ok',
    fetched: 500,
    parsed: 500,
    eligible: 1,
    returned: 1,
    duplicates: 0,
    excluded: { 'role-family-mismatch': 343 },
    outside_profile: {},
    duration_ms: 1_204,
    cache_hit: true,
    warnings: [],
  },
];

export async function fixtureRequest<T>(path: string, options: FixtureOptions = {}): Promise<T> {
  const url = new URL(path, 'https://fixtures.local');
  const method = options.method?.toUpperCase() ?? 'GET';
  const body = (options.body ?? {}) as Record<string, unknown>;

  if (url.pathname === '/auth/session') return { authenticated: true } as T;
  if (url.pathname === '/auth/login') return { authenticated: true } as T;
  if (url.pathname === '/auth/logout') return { authenticated: false } as T;

  if (url.pathname === '/jobs' && method === 'GET') {
    const jobs = filterJobs(url);
    return {
      jobs,
      total: jobs.length,
      page: 1,
      pageSize: 500,
      hasMore: false,
      issues: [],
      coverage: fixtureCoverage,
      fetchedAt: new Date().toISOString(),
      cache: { hit: true, expires_at: null },
    } as T;
  }

  if (url.pathname === '/jobs/sync-status') return { runs: fixtureRuns } as T;

  if (url.pathname.startsWith('/jobs/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const job = fixtureJobs.find((candidate) => candidate.id === id);
    if (!job) throw new Error('Fixture job not found');

    if (method === 'PATCH') {
      const status = body.status;
      if (status === 'active' || status === 'dismissed') job.status = status;
    }

    return { job: serializeJob(job) } as T;
  }

  if (url.pathname === '/ingest' && method === 'POST') {
    const source = url.searchParams.get('source') ?? 'fixture';
    fixtureRuns.unshift({
      id: `fixture-run-${fixtureRuns.length + 1}`,
      source,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      found: 8,
      matched: 2,
      inserted: 0,
      error: null,
    });
    return { run: fixtureRuns[0] } as T;
  }

  if (url.pathname === '/applications') {
    if (method === 'GET') {
      const jobKey = url.searchParams.get('job_key');
      if (jobKey) return { application: fixtureApplications.find((item) => item.job_key === jobKey) ?? null } as T;
      return { applications: fixtureApplications } as T;
    }

    if (method === 'POST') {
      const job = body.job as Job | undefined;
      if (!job) throw new Error('Fixture job snapshot is required');
      return { application: createApplication(job) } as T;
    }
  }

  if (url.pathname.startsWith('/applications/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const application = fixtureApplications.find((item) => item.id === id);
    if (!application) throw new Error('Fixture application not found');

    if (method === 'DELETE') {
      fixtureApplications.splice(fixtureApplications.indexOf(application), 1);
      return { ok: true } as T;
    }

    if (method === 'PATCH') {
      if (isApplicationStatus(body.status)) {
        application.status = body.status;
        application.status_changed_at = new Date().toISOString();
        if (body.status === 'applied') application.applied_at = application.status_changed_at;
      }
      if (typeof body.notes === 'string') application.notes = body.notes;
      if (typeof body.cover_letter === 'string') application.cover_letter = body.cover_letter;
      application.updated_at = new Date().toISOString();
      return { application } as T;
    }
  }

  if (url.pathname === '/cover-letter' && method === 'POST') {
    const job = body.job as Job | undefined;
    if (!job) throw new Error('Fixture job snapshot is required');
    return { letter: `Dear hiring team,\n\nI am excited to apply for the ${job.title} role at ${job.company}. My experience building Vue.js and TypeScript products would let me contribute quickly to your team.\n\nBest regards,\nAlex Example` } as T;
  }

  if (url.pathname === '/profile') {
    if (method === 'PUT') fixtureProfile = { ...fixtureProfile, ...body, updated_at: new Date().toISOString() } as CandidateProfile;
    return { profile: fixtureProfile } as T;
  }

  if (url.pathname === '/profile/cv') {
    if (method === 'POST') fixtureProfile = { ...fixtureProfile, cv_path: 'fixture-cv.pdf' };
    if (method === 'GET') return { url: 'data:text/plain,Fixture CV', path: fixtureProfile.cv_path } as T;
    return { profile: fixtureProfile } as T;
  }

  if (url.pathname === '/settings') {
    if (method === 'PUT') fixtureSettings = { ...fixtureSettings, ...body, updated_at: new Date().toISOString() };
    return {
      settings: fixtureSettings,
      hiddenJobs: fixtureJobs.filter((job) => job.status === 'dismissed').map(serializeJob),
      runs: fixtureRuns,
      sourceHealth: fixtureRuns.map((run) => ({
        source: run.source,
        last_run_at: run.finished_at ?? run.started_at,
        last_success_at: run.finished_at,
        last_nonempty_at: run.found > 0 ? run.finished_at : null,
        last_outcome: run.error ? 'failed' : run.found === 0 ? 'empty' : 'success',
        last_found: run.found,
        last_matched: run.matched,
        last_inserted: run.inserted,
        last_duration_ms: 320,
        last_error: run.error,
        consecutive_failures: run.error ? 1 : 0,
      })),
      notificationStatus: {
        tracked: 3,
        pending: 0,
        lastNotifiedAt: hoursAgo(3),
        migrationRequired: false,
      },
      telegramConfigured: true,
    } as T;
  }

  throw new Error(`No fixture is available for ${method} ${url.pathname}`);
}

function filterJobs(url: URL): Job[] {
  const statuses = (url.searchParams.get('status') ?? 'active').split(',');
  const minScore = Number(url.searchParams.get('minScore') ?? '-3');
  const search = url.searchParams.get('q')?.toLowerCase() ?? '';
  const source = url.searchParams.get('source');
  const workplace = url.searchParams.get('workplace');

  return fixtureJobs
    .filter((job) => statuses.includes(job.status))
    .filter((job) => job.score >= minScore)
    .filter((job) => !workplace || job.workplace === workplace)
    .filter((job) => !source || job.sources.includes(source))
    .filter((job) => !search || `${job.title} ${job.company} ${job.location ?? ''}`.toLowerCase().includes(search))
    .sort((left, right) => right.score - left.score)
    .map(serializeJob);
}

function serializeJob(job: Job): Job {
  return { ...job, application: null };
}

function createApplication(job: Job): FixtureApplication {
  const existing = fixtureApplications.find((item) => item.job_key === job.id);
  if (existing) return existing;

  const timestamp = new Date().toISOString();
  const application: FixtureApplication = {
    id: `fixture-application-${fixtureApplications.length + 1}`,
    job_key: job.id,
    job_snapshot: job,
    status: 'applied',
    cover_letter: null,
    notes: null,
    applied_at: null,
    status_changed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
  fixtureApplications.push(application);
  return application;
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return ['saved', 'applied', 'interviewing', 'offer', 'rejected'].includes(String(value));
}
