create table message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null check (template_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  title text not null check (char_length(title) between 1 and 160),
  channel text not null check (channel in ('dm', 'email', 'whatsapp', 'in_person')),
  language text not null check (language in ('de', 'it', 'en')),
  body text not null check (char_length(body) between 1 and 10000),
  variables text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_key, language)
);

create index message_templates_active_idx
  on message_templates (archived_at, template_key, language);

alter table message_templates enable row level security;

