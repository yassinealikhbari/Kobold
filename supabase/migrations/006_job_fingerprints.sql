-- Fingerprints prevent duplicate alerts without persisting pre-application job content.
create table if not exists job_fingerprints (
  fingerprint              text primary key,
  sources                  text[] not null default '{}',
  first_discovered_at      timestamptz not null default now(),
  last_discovered_at       timestamptz not null default now(),
  notification_attempted_at timestamptz,
  notified_at              timestamptz,
  notification_error       text
);

create index if not exists job_fingerprints_discovered_idx
  on job_fingerprints (first_discovered_at desc);

create index if not exists job_fingerprints_pending_idx
  on job_fingerprints (last_discovered_at desc)
  where notified_at is null;

alter table job_fingerprints enable row level security;
