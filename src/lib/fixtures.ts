import type { Application, ApplicationStatus } from '@/types/applications';
import type { CandidateProfile } from '@/types/profile';
import type { IngestRun, Job, SourceCoverage } from '@/types/jobs';
import type {
  Activity,
  Contact,
  MessageTemplate,
  Opportunity,
  Organization,
  SiteAudit,
  Task,
} from '@/types/crm';

type FixtureOptions = {
  method?: string;
  body?: unknown;
};

type FixtureApplication = Application;

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

const fixtureOrganizations: Organization[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Cavatappi',
    website: 'https://cavatappi.example/',
    industry: 'Hospitality',
    district: 'Graefekiez',
    postcode: '10967',
    country: 'DE',
    language: 'it',
    origin: 'walk_by',
    status: 'prospect',
    notes: 'Independent restaurant with an outdated mobile site.',
    address: null,
    lead_score: null,
    lead_score_reason: null,
    missing_function: null,
    staleness_evidence: null,
    hook_verified: null,
    source_place_id: null,
    archived_at: null,
    created_at: hoursAgo(72),
    updated_at: hoursAgo(4),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'RE Cucina',
    website: null,
    industry: 'Catering',
    district: 'Neukölln',
    postcode: '12043',
    country: 'DE',
    language: 'de',
    origin: 'referral',
    status: 'active',
    notes: null,
    address: null,
    lead_score: null,
    lead_score_reason: null,
    missing_function: null,
    staleness_evidence: null,
    hook_verified: null,
    source_place_id: null,
    archived_at: null,
    created_at: hoursAgo(120),
    updated_at: hoursAgo(24),
  },
];

const fixtureContacts: Contact[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    organization_id: fixtureOrganizations[0]!.id,
    full_name: 'Giulia Rossi',
    role: 'Owner',
    email: 'giulia@example.test',
    phone: '+49 30 555 0101',
    instagram: null,
    linkedin: null,
    language: 'it',
    is_primary: true,
    notes: null,
    archived_at: null,
    created_at: hoursAgo(48),
    updated_at: hoursAgo(3),
    organization: {
      id: fixtureOrganizations[0]!.id,
      name: fixtureOrganizations[0]!.name,
      district: fixtureOrganizations[0]!.district,
      language: fixtureOrganizations[0]!.language,
      archived_at: null,
    },
  },
];

const fixtureOpportunities: Opportunity[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    organization_id: fixtureOrganizations[0]!.id,
    title: 'Mobile-first restaurant site',
    stage: 'contacted',
    value_cents: 240000,
    currency: 'EUR',
    confidence: 45,
    expected_close: new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10),
    lost_reason: null,
    draft_email_subject: 'Quick fix for your mobile site',
    draft_email_body: 'Hi, I noticed your site is hard to use on mobile. Happy to send over a few quick fixes.',
    archived_at: null,
    stage_changed_at: hoursAgo(96),
    created_at: hoursAgo(144),
    updated_at: hoursAgo(4),
    organization: {
      id: fixtureOrganizations[0]!.id,
      name: fixtureOrganizations[0]!.name,
      status: fixtureOrganizations[0]!.status,
      archived_at: null,
      missing_function: fixtureOrganizations[0]!.missing_function,
    },
    open_task_count: 0,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    organization_id: fixtureOrganizations[1]!.id,
    title: 'Catering landing page',
    stage: 'proposal',
    value_cents: 180000,
    currency: 'EUR',
    confidence: 70,
    expected_close: new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10),
    lost_reason: null,
    draft_email_subject: null,
    draft_email_body: null,
    archived_at: null,
    stage_changed_at: hoursAgo(24),
    created_at: hoursAgo(240),
    updated_at: hoursAgo(24),
    organization: {
      id: fixtureOrganizations[1]!.id,
      name: fixtureOrganizations[1]!.name,
      status: fixtureOrganizations[1]!.status,
      archived_at: null,
      missing_function: fixtureOrganizations[1]!.missing_function,
    },
    open_task_count: 0,
  },
];

const fixtureActivities: Activity[] = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    subject_type: 'opportunity',
    subject_id: fixtureOpportunities[0]!.id,
    subject_label: fixtureOpportunities[0]!.title,
    subject_path: `/freelance/opportunities/${fixtureOpportunities[0]!.id}`,
    kind: 'stage_change',
    body: 'Stage changed from lead to contacted',
    metadata: { from: 'lead', to: 'contacted' },
    occurred_at: hoursAgo(96),
    created_at: hoursAgo(96),
  },
];

const fixtureTasks: Task[] = [
  {
    id: '77777777-7777-4777-8777-777777777777',
    subject_type: 'opportunity',
    subject_id: fixtureOpportunities[0]!.id,
    subject_label: fixtureOpportunities[0]!.title,
    subject_path: `/freelance/opportunities/${fixtureOpportunities[0]!.id}`,
    mode: 'freelance',
    title: 'Follow up after the first conversation',
    due_at: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
    done_at: null,
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
  },
];

const fixtureAudits: SiteAudit[] = [
  {
    id: '88888888-8888-4888-8888-888888888888',
    organization_id: fixtureOrganizations[0]!.id,
    requested_url: fixtureOrganizations[0]!.website!,
    final_url: fixtureOrganizations[0]!.website!,
    status: 'completed',
    http_status: 200,
    https: true,
    response_ms: 430,
    charset: 'utf-8',
    mojibake_detected: false,
    viewport_meta: false,
    page_weight_bytes: 340000,
    generator: 'WordPress 6',
    cms: 'WordPress',
    has_impressum: true,
    has_datenschutz: false,
    has_open_graph: true,
    last_modified: null,
    page_title: 'Cavatappi',
    error: null,
    audited_at: hoursAgo(2),
    created_at: hoursAgo(2),
  },
];

const fixtureTemplates: MessageTemplate[] = [
  {
    id: '99999999-9999-4999-8999-999999999999',
    template_key: 'site_intro',
    title: 'Website introduction',
    channel: 'dm',
    language: 'de',
    body: 'Hallo {{contact_first_name}},\n\nmir ist bei Ihrer Website aufgefallen: {{finding}}. Ich entwickle schnelle, moderne Websites für lokale Unternehmen in {{district}}.',
    variables: ['contact_first_name', 'finding', 'district'],
    archived_at: null,
    created_at: hoursAgo(12),
    updated_at: hoursAgo(12),
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    template_key: 'site_intro',
    title: 'Website introduction',
    channel: 'dm',
    language: 'it',
    body: 'Ciao {{contact_first_name}},\n\nho notato questo sul sito di {{organization_name}}: {{finding}}. Sviluppo siti moderni e veloci per attività locali.',
    variables: ['contact_first_name', 'organization_name', 'finding'],
    archived_at: null,
    created_at: hoursAgo(12),
    updated_at: hoursAgo(12),
  },
];

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
  task_notify_enabled: false,
  task_digest_sent_on: null as string | null,
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

  if (url.pathname === '/organizations') {
    if (method === 'GET') {
      const organizations = filterOrganizations(url);
      return { organizations } as T;
    }
    if (method === 'POST') {
      const organization = createFixtureOrganization(body);
      const duplicate = fixtureOrganizations.find(
        (item) => item.id !== organization.id && item.name.toLowerCase() === organization.name.toLowerCase(),
      );
      return {
        organization,
        warnings: duplicate ? [`An organization named “${duplicate.name}” already exists.`] : [],
      } as T;
    }
  }

  if (url.pathname.startsWith('/organizations/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const organization = fixtureOrganizations.find((item) => item.id === id);
    if (!organization) throw new Error('Fixture organization not found');
    if (method === 'GET') {
      return {
        organization: { ...organization },
        contacts: fixtureContacts
          .filter((item) => item.organization_id === id && !item.archived_at)
          .map((item) => ({ ...item })),
        opportunities: fixtureOpportunities
          .filter((item) => item.organization_id === id && !item.archived_at)
          .map(withFixtureOpportunityOrganization),
      } as T;
    }
    if (method === 'PATCH') {
      Object.assign(organization, body, {
        archived_at: body.archived === false ? null : organization.archived_at,
        updated_at: new Date().toISOString(),
      });
      return { organization: { ...organization } } as T;
    }
    if (method === 'DELETE') {
      organization.archived_at = new Date().toISOString();
      organization.updated_at = organization.archived_at;
      return { organization: { ...organization } } as T;
    }
  }

  if (url.pathname === '/contacts') {
    if (method === 'GET') {
      const organizationId = url.searchParams.get('organization_id');
      const archived = url.searchParams.get('archived') === 'true';
      return {
        contacts: fixtureContacts
          .filter((item) => Boolean(item.archived_at) === archived)
          .filter((item) => !organizationId || item.organization_id === organizationId)
          .map(withFixtureOrganization),
      } as T;
    }
    if (method === 'POST') return { contact: createFixtureContact(body) } as T;
  }

  if (url.pathname.startsWith('/contacts/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const contact = fixtureContacts.find((item) => item.id === id);
    if (!contact) throw new Error('Fixture contact not found');
    if (method === 'GET') return { contact: withFixtureOrganization(contact) } as T;
    if (method === 'PATCH') {
      Object.assign(contact, body, {
        archived_at: body.archived === false ? null : contact.archived_at,
        updated_at: new Date().toISOString(),
      });
      return { contact: withFixtureOrganization(contact) } as T;
    }
    if (method === 'DELETE') {
      contact.archived_at = new Date().toISOString();
      contact.updated_at = contact.archived_at;
      return { contact: { ...contact } } as T;
    }
  }

  if (url.pathname === '/opportunities') {
    if (method === 'GET') {
      const stage = url.searchParams.get('stage');
      const organizationId = url.searchParams.get('organization_id');
      return {
        opportunities: fixtureOpportunities
          .filter((item) => !item.archived_at)
          .filter((item) => !stage || item.stage === stage)
          .filter((item) => !organizationId || item.organization_id === organizationId)
          .map(withFixtureOpportunityOrganization),
      } as T;
    }
    if (method === 'POST') return { opportunity: createFixtureOpportunity(body) } as T;
  }

  if (url.pathname.startsWith('/opportunities/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const opportunity = fixtureOpportunities.find((item) => item.id === id);
    if (!opportunity) throw new Error('Fixture opportunity not found');
    if (method === 'GET') {
      return { opportunity: withFixtureOpportunityOrganization(opportunity) } as T;
    }
    if (method === 'PATCH') {
      const previousStage = opportunity.stage;
      const stageChanged = typeof body.stage === 'string' && body.stage !== opportunity.stage;
      Object.assign(opportunity, body, {
        lost_reason: body.stage && body.stage !== 'lost' ? null : body.lost_reason ?? opportunity.lost_reason,
        archived_at: body.archived === false ? null : opportunity.archived_at,
        stage_changed_at: stageChanged ? new Date().toISOString() : opportunity.stage_changed_at,
        updated_at: new Date().toISOString(),
      });
      if (stageChanged) recordFixtureStageChange('opportunity', opportunity.id, previousStage, opportunity.stage);
      return { opportunity: withFixtureOpportunityOrganization(opportunity) } as T;
    }
    if (method === 'DELETE') {
      opportunity.archived_at = new Date().toISOString();
      opportunity.updated_at = opportunity.archived_at;
      return { opportunity: { ...opportunity } } as T;
    }
  }

  if (url.pathname === '/activities') {
    if (method === 'GET') {
      const subjectType = url.searchParams.get('subject_type');
      const subjectId = url.searchParams.get('subject_id');
      return {
        activities: fixtureActivities
          .filter((item) => item.subject_type === subjectType && item.subject_id === subjectId)
          .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
          .map((item) => ({ ...item })),
      } as T;
    }
    if (method === 'POST') return { activity: createFixtureActivity(body) } as T;
  }

  if (url.pathname.startsWith('/activities/') && method === 'DELETE') {
    const id = url.pathname.split('/').at(-1) ?? '';
    const index = fixtureActivities.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Fixture activity not found');
    fixtureActivities.splice(index, 1);
    return { ok: true } as T;
  }

  if (url.pathname === '/tasks') {
    if (method === 'GET') {
      const scope = url.searchParams.get('scope') ?? 'all';
      const subjectType = url.searchParams.get('subject_type');
      const subjectId = url.searchParams.get('subject_id');
      return {
        tasks: fixtureTasks
          .filter((item) => !item.done_at)
          .filter((item) => !subjectType || item.subject_type === subjectType)
          .filter((item) => !subjectId || item.subject_id === subjectId)
          .filter((item) => fixtureTaskInScope(item, scope))
          .sort((left, right) => (left.due_at ?? 'z').localeCompare(right.due_at ?? 'z'))
          .map((item) => ({ ...item })),
      } as T;
    }
    if (method === 'POST') return { task: createFixtureTask(body) } as T;
  }

  if (url.pathname.startsWith('/tasks/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const task = fixtureTasks.find((item) => item.id === id);
    if (!task) throw new Error('Fixture task not found');
    if (method === 'PATCH') {
      if (typeof body.done === 'boolean') task.done_at = body.done ? new Date().toISOString() : null;
      if (typeof body.title === 'string') task.title = body.title;
      if (typeof body.due_at === 'string' || body.due_at === null) task.due_at = body.due_at;
      task.updated_at = new Date().toISOString();
      return { task: { ...task } } as T;
    }
    if (method === 'DELETE') {
      fixtureTasks.splice(fixtureTasks.indexOf(task), 1);
      return { ok: true } as T;
    }
  }

  if (url.pathname === '/audit') {
    if (method === 'GET') {
      const organizationId = url.searchParams.get('organization_id');
      return {
        audits: fixtureAudits
          .filter((item) => item.organization_id === organizationId)
          .sort((left, right) => right.audited_at.localeCompare(left.audited_at))
          .map((item) => ({ ...item })),
      } as T;
    }
    if (method === 'POST') return { audit: createFixtureAudit(body) } as T;
  }

  if (url.pathname === '/templates') {
    if (method === 'GET') {
      return {
        templates: fixtureTemplates.filter((item) => !item.archived_at).map((item) => ({ ...item })),
      } as T;
    }
    if (method === 'POST') return { template: createFixtureTemplate(body) } as T;
  }

  if (url.pathname === '/metrics') {
    return {
      metrics: {
        newLeadsPerWeek: [
          { week: new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10), count: 1 },
          { week: now.toISOString().slice(0, 10), count: 2 },
        ],
        contactToConversationRate: 50,
        proposalWinRate: 33.3,
        averageDaysPerStage: [
          { stage: 'lead', days: 3.2 },
          { stage: 'contacted', days: 5.5 },
          { stage: 'proposal', days: 4 },
        ],
        pipelineValueOverTime: [
          { at: hoursAgo(24), values: { EUR: 420000 } },
        ],
        lossReasons: [{ reason: 'timing', count: 1 }],
        currentPipelineByCurrency: { EUR: 420000 },
      },
    } as T;
  }

  if (url.pathname.startsWith('/templates/')) {
    const id = url.pathname.split('/').at(-1) ?? '';
    const template = fixtureTemplates.find((item) => item.id === id);
    if (!template) throw new Error('Fixture template not found');
    if (method === 'PATCH') {
      Object.assign(template, body, { updated_at: new Date().toISOString() });
      return { template: { ...template } } as T;
    }
    if (method === 'DELETE') {
      template.archived_at = new Date().toISOString();
      template.updated_at = template.archived_at;
      return { template: { ...template } } as T;
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
      const previousStatus = application.status;
      if (isApplicationStatus(body.status)) {
        application.status = body.status;
        application.status_changed_at = new Date().toISOString();
        if (body.status === 'applied') application.applied_at = application.status_changed_at;
      }
      if (typeof body.notes === 'string') application.notes = body.notes;
      if (typeof body.cover_letter === 'string') application.cover_letter = body.cover_letter;
      if (typeof body.organization_id === 'string' || body.organization_id === null) {
        application.organization_id = body.organization_id;
      }
      application.updated_at = new Date().toISOString();
      if (previousStatus !== application.status) {
        recordFixtureStageChange('application', application.id, previousStatus, application.status);
      }
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
        lastSentAt: hoursAgo(3),
        baselineAt: null,
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

function filterOrganizations(url: URL): Organization[] {
  const q = url.searchParams.get('q')?.toLowerCase() ?? '';
  const status = url.searchParams.get('status');
  const language = url.searchParams.get('language');
  const district = url.searchParams.get('district')?.toLowerCase();
  const hasWebsite = url.searchParams.get('has_website');
  const archived = url.searchParams.get('archived') === 'true';
  return fixtureOrganizations
    .filter((item) => Boolean(item.archived_at) === archived)
    .filter((item) => !q || item.name.toLowerCase().includes(q))
    .filter((item) => !status || item.status === status)
    .filter((item) => !language || item.language === language)
    .filter((item) => !district || item.district?.toLowerCase() === district)
    .filter((item) => hasWebsite === null || Boolean(item.website) === (hasWebsite === 'true'))
    .map((item) => ({ ...item }));
}

function createFixtureOrganization(body: Record<string, unknown>): Organization {
  const timestamp = new Date().toISOString();
  const organization: Organization = {
    id: `${String(fixtureOrganizations.length + 10).padStart(8, '0')}-0000-4000-8000-000000000001`,
    name: String(body.name ?? '').trim(),
    website: typeof body.website === 'string' && body.website ? body.website : null,
    industry: typeof body.industry === 'string' && body.industry ? body.industry : null,
    district: typeof body.district === 'string' && body.district ? body.district : null,
    postcode: typeof body.postcode === 'string' && body.postcode ? body.postcode : null,
    country: typeof body.country === 'string' ? body.country : 'DE',
    language: body.language === 'it' || body.language === 'en' ? body.language : 'de',
    origin:
      body.origin === 'walk_by' || body.origin === 'referral' || body.origin === 'inbound' ||
      body.origin === 'event' || body.origin === 'other'
        ? body.origin
        : 'manual',
    status:
      body.status === 'active' || body.status === 'dormant' || body.status === 'closed' ||
      body.status === 'disqualified'
        ? body.status
        : 'prospect',
    notes: typeof body.notes === 'string' && body.notes ? body.notes : null,
    address: typeof body.address === 'string' && body.address ? body.address : null,
    lead_score: typeof body.lead_score === 'number' ? body.lead_score : null,
    lead_score_reason: typeof body.lead_score_reason === 'string' && body.lead_score_reason ? body.lead_score_reason : null,
    missing_function: typeof body.missing_function === 'string' && body.missing_function ? body.missing_function : null,
    staleness_evidence: typeof body.staleness_evidence === 'string' && body.staleness_evidence ? body.staleness_evidence : null,
    hook_verified: typeof body.hook_verified === 'string' && body.hook_verified ? body.hook_verified : null,
    source_place_id: typeof body.source_place_id === 'string' && body.source_place_id ? body.source_place_id : null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  fixtureOrganizations.unshift(organization);
  return { ...organization };
}

function createFixtureContact(body: Record<string, unknown>): Contact {
  const timestamp = new Date().toISOString();
  const contact: Contact = {
    id: `${String(fixtureContacts.length + 20).padStart(8, '0')}-0000-4000-8000-000000000001`,
    organization_id: typeof body.organization_id === 'string' ? body.organization_id : null,
    full_name: String(body.full_name ?? '').trim(),
    role: typeof body.role === 'string' && body.role ? body.role : null,
    email: typeof body.email === 'string' && body.email ? body.email : null,
    phone: typeof body.phone === 'string' && body.phone ? body.phone : null,
    instagram: typeof body.instagram === 'string' && body.instagram ? body.instagram : null,
    linkedin: typeof body.linkedin === 'string' && body.linkedin ? body.linkedin : null,
    language: body.language === 'de' || body.language === 'it' || body.language === 'en' ? body.language : null,
    is_primary: body.is_primary === true,
    notes: typeof body.notes === 'string' && body.notes ? body.notes : null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  if (contact.is_primary && contact.organization_id) {
    for (const item of fixtureContacts) {
      if (item.organization_id === contact.organization_id) item.is_primary = false;
    }
  }
  fixtureContacts.unshift(contact);
  return withFixtureOrganization(contact);
}

function withFixtureOrganization(contact: Contact): Contact {
  const organization = fixtureOrganizations.find((item) => item.id === contact.organization_id);
  return {
    ...contact,
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          district: organization.district,
          language: organization.language,
          archived_at: organization.archived_at,
        }
      : null,
  };
}

function createFixtureTemplate(body: Record<string, unknown>): MessageTemplate {
  const timestamp = new Date().toISOString();
  const title = String(body.title ?? '').trim();
  const template: MessageTemplate = {
    id: `${String(fixtureTemplates.length + 80).padStart(8, '0')}-0000-4000-8000-000000000001`,
    template_key:
      typeof body.template_key === 'string' && body.template_key
        ? body.template_key
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    title,
    channel:
      body.channel === 'email' || body.channel === 'whatsapp' || body.channel === 'in_person'
        ? body.channel
        : 'dm',
    language: body.language === 'it' || body.language === 'en' ? body.language : 'de',
    body: String(body.body ?? ''),
    variables: [...String(body.body ?? '').matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((match) => match[1]!),
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  fixtureTemplates.push(template);
  return { ...template };
}

function createFixtureOpportunity(body: Record<string, unknown>): Opportunity {
  const timestamp = new Date().toISOString();
  const opportunity: Opportunity = {
    id: `${String(fixtureOpportunities.length + 30).padStart(8, '0')}-0000-4000-8000-000000000001`,
    organization_id: String(body.organization_id ?? ''),
    title: String(body.title ?? '').trim(),
    stage:
      body.stage === 'contacted' || body.stage === 'conversation' || body.stage === 'proposal' ||
      body.stage === 'won' || body.stage === 'lost'
        ? body.stage
        : 'lead',
    value_cents: typeof body.value_cents === 'number' ? body.value_cents : null,
    currency: typeof body.currency === 'string' ? body.currency : 'EUR',
    confidence: typeof body.confidence === 'number' ? body.confidence : null,
    expected_close: typeof body.expected_close === 'string' && body.expected_close ? body.expected_close : null,
    lost_reason:
      body.lost_reason === 'no budget' || body.lost_reason === 'no response' ||
      body.lost_reason === 'timing' || body.lost_reason === 'chose someone else' ||
      body.lost_reason === 'not a fit' || body.lost_reason === 'business closed'
        ? body.lost_reason
        : null,
    draft_email_subject: typeof body.draft_email_subject === 'string' ? body.draft_email_subject : null,
    draft_email_body: typeof body.draft_email_body === 'string' ? body.draft_email_body : null,
    archived_at: null,
    stage_changed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    organization: null,
    open_task_count: 0,
  };
  fixtureOpportunities.unshift(opportunity);
  return withFixtureOpportunityOrganization(opportunity);
}

function withFixtureOpportunityOrganization(opportunity: Opportunity): Opportunity {
  const organization = fixtureOrganizations.find((item) => item.id === opportunity.organization_id);
  return {
    ...opportunity,
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          status: organization.status,
          archived_at: organization.archived_at,
          missing_function: organization.missing_function,
        }
      : null,
  };
}

function createFixtureActivity(body: Record<string, unknown>): Activity {
  const timestamp = new Date().toISOString();
  const subject = fixtureSubject(String(body.subject_type), String(body.subject_id));
  const activity: Activity = {
    id: `${String(fixtureActivities.length + 40).padStart(8, '0')}-0000-4000-8000-000000000001`,
    subject_type: subject.type,
    subject_id: subject.id,
    subject_label: subject.label,
    subject_path: subject.path,
    kind:
      body.kind === 'visit' || body.kind === 'dm' || body.kind === 'email' ||
      body.kind === 'call' || body.kind === 'meeting' || body.kind === 'proposal'
        ? body.kind
        : 'note',
    body: typeof body.body === 'string' && body.body ? body.body : null,
    metadata: {},
    occurred_at: timestamp,
    created_at: timestamp,
  };
  fixtureActivities.unshift(activity);
  return { ...activity };
}

function createFixtureTask(body: Record<string, unknown>): Task {
  const timestamp = new Date().toISOString();
  const subject = body.subject_type && body.subject_id
    ? fixtureSubject(String(body.subject_type), String(body.subject_id))
    : null;
  const task: Task = {
    id: `${String(fixtureTasks.length + 50).padStart(8, '0')}-0000-4000-8000-000000000001`,
    subject_type: subject?.type ?? null,
    subject_id: subject?.id ?? null,
    subject_label: subject?.label ?? null,
    subject_path: subject?.path ?? null,
    mode: subject?.mode ?? null,
    title: String(body.title ?? '').trim(),
    due_at: typeof body.due_at === 'string' ? body.due_at : null,
    done_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  fixtureTasks.push(task);
  return { ...task };
}

function fixtureSubject(type: string, id: string): {
  type: Activity['subject_type'];
  id: string;
  label: string;
  path: string;
  mode: Task['mode'];
} {
  if (type === 'organization') {
    const item = fixtureOrganizations.find((value) => value.id === id);
    return { type, id, label: item?.name ?? 'Organization', path: `/freelance/organizations/${id}`, mode: 'freelance' };
  }
  if (type === 'contact') {
    const item = fixtureContacts.find((value) => value.id === id);
    return { type, id, label: item?.full_name ?? 'Contact', path: `/freelance/contacts/${id}`, mode: 'freelance' };
  }
  if (type === 'application') {
    const item = fixtureApplications.find((value) => value.id === id);
    return { type, id, label: item?.job_snapshot.title ?? 'Application', path: '/tracker', mode: 'jobs' };
  }
  const item = fixtureOpportunities.find((value) => value.id === id);
  return { type: 'opportunity', id, label: item?.title ?? 'Opportunity', path: `/freelance/opportunities/${id}`, mode: 'freelance' };
}

function fixtureTaskInScope(task: Task, scope: string): boolean {
  if (scope === 'all' || !task.due_at) return scope === 'all';
  const due = new Date(task.due_at).getTime();
  const current = Date.now();
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  if (scope === 'overdue') return due < current;
  if (scope === 'today') return due >= current && due <= endToday.getTime();
  return due > endToday.getTime() && due <= endToday.getTime() + 7 * 86_400_000;
}

function recordFixtureStageChange(
  type: 'opportunity' | 'application',
  id: string,
  from: string,
  to: string,
) {
  const timestamp = new Date().toISOString();
  const subject = fixtureSubject(type, id);
  fixtureActivities.unshift({
    id: `${String(fixtureActivities.length + 60).padStart(8, '0')}-0000-4000-8000-000000000001`,
    subject_type: type,
    subject_id: id,
    subject_label: subject.label,
    subject_path: subject.path,
    kind: 'stage_change',
    body: `${type === 'application' ? 'Status' : 'Stage'} changed from ${from} to ${to}`,
    metadata: { from, to },
    occurred_at: timestamp,
    created_at: timestamp,
  });
}

function createFixtureAudit(body: Record<string, unknown>): SiteAudit {
  const timestamp = new Date().toISOString();
  const audit: SiteAudit = {
    id: `${String(fixtureAudits.length + 70).padStart(8, '0')}-0000-4000-8000-000000000001`,
    organization_id: typeof body.organization_id === 'string' ? body.organization_id : null,
    requested_url: String(body.url ?? ''),
    final_url: String(body.url ?? ''),
    status: 'completed',
    http_status: 200,
    https: String(body.url ?? '').startsWith('https://'),
    response_ms: 380,
    charset: 'utf-8',
    mojibake_detected: false,
    viewport_meta: true,
    page_weight_bytes: 210000,
    generator: null,
    cms: null,
    has_impressum: false,
    has_datenschutz: false,
    has_open_graph: false,
    last_modified: null,
    page_title: new URL(String(body.url)).hostname,
    error: null,
    audited_at: timestamp,
    created_at: timestamp,
  };
  fixtureAudits.unshift(audit);
  return { ...audit };
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
    organization_id: null,
  };
  fixtureApplications.push(application);
  return application;
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return ['saved', 'applied', 'interviewing', 'offer', 'rejected'].includes(String(value));
}
