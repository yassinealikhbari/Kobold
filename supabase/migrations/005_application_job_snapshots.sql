-- New applications own a job snapshot. KOBOLD no longer reads or writes the jobs table.
alter table applications add column if not exists job_key text;
alter table applications add column if not exists job_snapshot jsonb;

update applications as application
set
  job_key = job.dedupe_key,
  job_snapshot = jsonb_build_object(
    'id', job.dedupe_key,
    'title', job.title,
    'company', job.company,
    'location', job.location,
    'workplace', job.workplace,
    'url', job.url,
    'apply_url', job.apply_url,
    'ats', job.ats,
    'sources', job.sources,
    'tags', job.tags,
    'description_html', job.description_html,
    'description_text', job.description_text,
    'seniority', job.seniority,
    'german_required', job.german_required,
    'salary_text', job.salary_text,
    'score', job.score,
    'score_reasons', coalesce(job.score_reasons, '{}'::text[]),
    'posted_at', job.posted_at,
    'first_seen_at', job.first_seen_at,
    'last_seen_at', job.last_seen_at,
    'status', job.status,
    'application', null
  )
from jobs as job
where application.job_id = job.id and application.job_key is null;

alter table applications alter column job_id drop not null;
create unique index if not exists applications_job_key_unique on applications (job_key) where job_key is not null;
