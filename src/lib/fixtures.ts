import type { Application, ApplicationStatus } from '@/types/applications';
import type { CandidateProfile } from '@/types/profile';
import type { IngestRun, Job } from '@/types/jobs';

type FixtureOptions = {
  method?: string;
  body?: unknown;
};

type FixtureApplication = Application & {
  jobs: {
    id: string;
    title: string;
    company: string;
    url: string;
    status: string;
  };
};

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

const fixtureJobs: Job[] = [
  {
    id: 'fixture-job-1',
    title: 'Senior Vue.js Engineer',
    company: 'Northstar Labs',
    location: 'Berlin, Germany',
    workplace: 'hybrid',
    url: 'https://example.com/jobs/vue-engineer',
    apply_url: 'https://example.com/jobs/vue-engineer/apply',
    ats: 'greenhouse',
    sources: ['vuejobs'],
    tags: ['Vue.js', 'TypeScript', 'Nuxt'],
    description_html: '<p>Build a product with Vue.js, Nuxt, and TypeScript.</p>',
    description_text: 'Build a product with Vue.js, Nuxt, and TypeScript.',
    seniority: 'senior',
    german_required: false,
    salary_text: 'EUR 70,000 - 85,000',
    score: 8,
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
    location: 'Remote - Europe',
    workplace: 'remote',
    url: 'https://example.com/jobs/frontend-engineer',
    apply_url: null,
    ats: null,
    sources: ['workingnomads', 'remoteok'],
    tags: ['Vue', 'TypeScript'],
    description_html: '<p>Help shape a remote-first developer platform.</p>',
    description_text: 'Help shape a remote-first developer platform.',
    seniority: 'mid',
    german_required: false,
    salary_text: null,
    score: 7,
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
    location: 'Remote',
    workplace: 'remote',
    url: 'https://example.com/jobs/vue-developer',
    apply_url: null,
    ats: 'lever',
    sources: ['arbeitnow'],
    tags: ['Vue.js'],
    description_html: '<p>Maintain a Vue.js storefront.</p>',
    description_text: 'Maintain a Vue.js storefront.',
    seniority: 'unknown',
    german_required: false,
    salary_text: null,
    score: 2,
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
    location: 'Berlin, Germany',
    workplace: 'onsite',
    url: 'https://example.com/jobs/archive-vue',
    apply_url: null,
    ats: null,
    sources: ['berlinstartupjobs'],
    tags: ['Vue.js'],
    description_html: '<p>A previously listed Berlin role.</p>',
    description_text: 'A previously listed Berlin role.',
    seniority: 'mid',
    german_required: false,
    salary_text: null,
    score: 6,
    posted_at: hoursAgo(220),
    first_seen_at: hoursAgo(220),
    last_seen_at: hoursAgo(220),
    status: 'stale',
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

export async function fixtureRequest<T>(path: string, options: FixtureOptions = {}): Promise<T> {
  const url = new URL(path, 'https://fixtures.local');
  const method = options.method?.toUpperCase() ?? 'GET';
  const body = (options.body ?? {}) as Record<string, unknown>;

  if (url.pathname === '/auth/session') return { authenticated: true } as T;
  if (url.pathname === '/auth/login') return { authenticated: true } as T;
  if (url.pathname === '/auth/logout') return { authenticated: false } as T;

  if (url.pathname === '/jobs' && method === 'GET') {
    return { jobs: filterJobs(url), total: filterJobs(url).length } as T;
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
      const jobId = url.searchParams.get('job_id');
      if (jobId) return { application: fixtureApplications.find((item) => item.job_id === jobId) ?? null } as T;
      return { applications: fixtureApplications } as T;
    }

    if (method === 'POST') {
      const jobId = typeof body.job_id === 'string' ? body.job_id : '';
      return { application: createApplication(jobId) } as T;
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
    const jobId = typeof body.job_id === 'string' ? body.job_id : '';
    const application = createApplication(jobId);
    application.cover_letter = `Dear hiring team,\n\nI am excited to apply for the ${application.jobs.title} role at ${application.jobs.company}. My experience building Vue.js and TypeScript products would let me contribute quickly to your team.\n\nBest regards,\nAlex Example`;
    application.updated_at = new Date().toISOString();
    return { letter: application.cover_letter, application } as T;
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
  const application = fixtureApplications.find((item) => item.job_id === job.id);
  return {
    ...job,
    application: application ? { id: application.id, status: application.status } : null,
  };
}

function createApplication(jobId: string): FixtureApplication {
  const existing = fixtureApplications.find((item) => item.job_id === jobId);
  if (existing) return existing;

  const job = fixtureJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('Fixture job not found');

  const timestamp = new Date().toISOString();
  const application: FixtureApplication = {
    id: `fixture-application-${fixtureApplications.length + 1}`,
    job_id: jobId,
    status: 'saved',
    cover_letter: null,
    notes: null,
    applied_at: null,
    status_changed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    jobs: { id: job.id, title: job.title, company: job.company, url: job.url, status: job.status },
  };
  fixtureApplications.push(application);
  return application;
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return ['saved', 'applied', 'interviewing', 'offer', 'rejected'].includes(String(value));
}
