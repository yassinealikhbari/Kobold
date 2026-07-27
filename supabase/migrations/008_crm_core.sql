create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  website text check (website is null or char_length(website) <= 2048),
  industry text check (industry is null or char_length(industry) <= 120),
  district text check (district is null or char_length(district) <= 120),
  postcode text check (postcode is null or postcode ~ '^[0-9A-Za-z -]{3,12}$'),
  country text not null default 'DE' check (country ~ '^[A-Z]{2}$'),
  language text not null default 'de' check (language in ('de', 'it', 'en')),
  origin text not null default 'manual'
    check (origin in ('manual', 'walk_by', 'referral', 'inbound', 'event', 'other')),
  status text not null default 'prospect'
    check (status in ('prospect', 'active', 'dormant', 'closed', 'disqualified')),
  notes text check (notes is null or char_length(notes) <= 10000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_active_name_idx
  on organizations (archived_at, lower(name));
create index organizations_filters_idx
  on organizations (status, language, postcode)
  where archived_at is null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 160),
  role text check (role is null or char_length(role) <= 120),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 80),
  instagram text check (instagram is null or char_length(instagram) <= 2048),
  linkedin text check (linkedin is null or char_length(linkedin) <= 2048),
  language text check (language is null or language in ('de', 'it', 'en')),
  is_primary boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 10000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_active_name_idx
  on contacts (archived_at, lower(full_name));
create index contacts_organization_idx
  on contacts (organization_id, archived_at);

alter table organizations enable row level security;
alter table contacts enable row level security;

