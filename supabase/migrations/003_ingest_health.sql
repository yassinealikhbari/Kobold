alter table ingest_runs
  add column outcome text,
  add column duration_ms integer;

update ingest_runs
set outcome = case when error is null then 'success' else 'failed' end;

alter table ingest_runs
  alter column outcome set default 'success',
  alter column outcome set not null;

alter table settings
  alter column notify_enabled set default false;

create table source_health (
  source               text primary key,
  last_run_at          timestamptz not null,
  last_success_at      timestamptz,
  last_nonempty_at     timestamptz,
  last_outcome         text not null,
  last_found           integer not null default 0,
  last_matched         integer not null default 0,
  last_inserted        integer not null default 0,
  last_duration_ms     integer,
  last_error           text,
  consecutive_failures integer not null default 0,
  updated_at           timestamptz not null default now()
);

create index jobs_status_last_seen_idx on jobs (status, last_seen_at desc);
create index ingest_runs_source_started_idx on ingest_runs (source, started_at desc);
