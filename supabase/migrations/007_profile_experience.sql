alter table profile
  add column if not exists experience_years numeric not null default 5.5
  check (experience_years >= 0 and experience_years <= 60);
