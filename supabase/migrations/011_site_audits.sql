create table site_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  requested_url text not null check (char_length(requested_url) <= 2048),
  final_url text check (final_url is null or char_length(final_url) <= 2048),
  status text not null check (status in ('completed', 'failed')),
  http_status integer,
  https boolean,
  response_ms integer,
  charset text,
  mojibake_detected boolean,
  viewport_meta boolean,
  page_weight_bytes integer,
  generator text,
  cms text,
  has_impressum boolean,
  has_datenschutz boolean,
  has_open_graph boolean,
  last_modified text,
  page_title text,
  error text,
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index site_audits_organization_idx
  on site_audits (organization_id, audited_at desc);

alter table site_audits enable row level security;

