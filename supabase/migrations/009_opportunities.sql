create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null check (char_length(title) between 1 and 200),
  stage text not null default 'lead'
    check (stage in ('lead', 'contacted', 'conversation', 'proposal', 'won', 'lost')),
  value_cents integer check (value_cents is null or value_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  confidence integer check (confidence is null or confidence between 0 and 100),
  expected_close date,
  lost_reason text check (
    lost_reason is null or lost_reason in (
      'no budget',
      'no response',
      'timing',
      'chose someone else',
      'not a fit',
      'business closed'
    )
  ),
  archived_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'lost' or lost_reason is not null)
);

create index opportunities_pipeline_idx
  on opportunities (stage, stage_changed_at desc)
  where archived_at is null;
create index opportunities_organization_idx
  on opportunities (organization_id, archived_at);

alter table opportunities enable row level security;

