alter table applications
  add column if not exists status_changed_at timestamptz;

update applications
set status_changed_at = coalesce(applied_at, updated_at, created_at)
where status_changed_at is null;

alter table applications
  alter column status_changed_at set default now(),
  alter column status_changed_at set not null;
