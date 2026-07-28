alter table organizations
  add column if not exists address text
    check (address is null or char_length(address) <= 500),
  add column if not exists lead_score numeric
    check (lead_score is null or lead_score >= 0),
  add column if not exists lead_score_reason text
    check (lead_score_reason is null or char_length(lead_score_reason) <= 2000),
  add column if not exists missing_function text
    check (missing_function is null or char_length(missing_function) <= 500),
  add column if not exists staleness_evidence text
    check (staleness_evidence is null or char_length(staleness_evidence) <= 2000),
  add column if not exists hook_verified text
    check (hook_verified is null or char_length(hook_verified) <= 500),
  add column if not exists source_place_id text
    check (source_place_id is null or char_length(source_place_id) <= 120);

-- Google Place ID is stable across re-exports of the same source list, so it is
-- the primary key for making CSV re-import idempotent.
create unique index if not exists organizations_source_place_id_idx
  on organizations (source_place_id)
  where source_place_id is not null;

-- Supports the import route's dedupe-by-domain and dedupe-by-phone lookups.
create index if not exists organizations_website_lookup_idx
  on organizations (lower(website))
  where website is not null;

create index if not exists contacts_phone_lookup_idx
  on contacts (phone)
  where phone is not null;
