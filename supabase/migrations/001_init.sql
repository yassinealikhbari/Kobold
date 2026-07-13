create extension if not exists pgcrypto;

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  dedupe_key    text unique not null,
  title         text not null,
  company       text not null,
  location      text,
  workplace     text not null default 'unknown'
                check (workplace in ('remote','hybrid','onsite','unknown')),
  url           text not null,
  apply_url     text,
  ats           text,
  sources       text[] not null,
  tags          text[] not null default '{}',
  description_html text,
  description_text text,
  seniority     text check (seniority in ('mid','senior','mixed','unknown')),
  german_required boolean not null default false,
  salary_text   text,
  score         int not null default 0,
  posted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  status        text not null default 'active'
                check (status in ('active','stale','expired','dismissed'))
);
create index jobs_status_score_idx on jobs (status, score desc, posted_at desc);

create table applications (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references jobs(id) on delete cascade,
  status        text not null default 'saved'
                check (status in ('saved','applied','interviewing','offer','rejected')),
  cover_letter  text,
  notes         text,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (job_id)
);

create table profile (
  id            int primary key default 1 check (id = 1),
  full_name     text, email text, phone text,
  location      text, linkedin text, github text, portfolio text,
  summary       text,
  skills        text[] default '{}',
  languages     jsonb default '[]',
  work_history  jsonb default '[]',
  cv_path       text,
  updated_at    timestamptz not null default now()
);

create table ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  found         int default 0,
  matched       int default 0,
  inserted      int default 0,
  error         text
);

create table settings (
  id                int primary key default 1 check (id = 1),
  notify_enabled    boolean not null default true,
  min_score_notify  int not null default 3,
  updated_at        timestamptz not null default now()
);

alter table jobs enable row level security;
alter table applications enable row level security;
alter table profile enable row level security;
alter table ingest_runs enable row level security;
alter table settings enable row level security;
