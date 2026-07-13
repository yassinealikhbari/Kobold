alter table jobs
  add column score_reasons text[] not null default '{}';

alter table ingest_runs
  add column inserted_active integer not null default 0,
  add column inserted_dismissed integer not null default 0,
  add column updated integer not null default 0;
