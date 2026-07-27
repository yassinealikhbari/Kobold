create table activities (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type in ('organization', 'contact', 'opportunity', 'application')),
  subject_id uuid not null,
  subject_label text not null check (char_length(subject_label) between 1 and 240),
  subject_path text not null check (char_length(subject_path) between 1 and 500),
  kind text not null
    check (kind in ('note', 'visit', 'dm', 'email', 'call', 'meeting', 'proposal', 'stage_change', 'system')),
  body text check (body is null or char_length(body) <= 10000),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index activities_subject_idx
  on activities (subject_type, subject_id, occurred_at desc);
create index activities_kind_occurred_idx
  on activities (kind, occurred_at desc);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  subject_type text
    check (subject_type is null or subject_type in ('organization', 'contact', 'opportunity', 'application')),
  subject_id uuid,
  subject_label text,
  subject_path text,
  mode text check (mode is null or mode in ('freelance', 'jobs')),
  title text not null check (char_length(title) between 1 and 240),
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (subject_type is null and subject_id is null) or
    (subject_type is not null and subject_id is not null)
  )
);

create index tasks_open_due_idx on tasks (due_at)
  where done_at is null;
create index tasks_subject_idx on tasks (subject_type, subject_id, done_at);

insert into activities (
  subject_type,
  subject_id,
  subject_label,
  subject_path,
  kind,
  body,
  metadata,
  occurred_at,
  created_at
)
select
  'opportunity',
  opportunity.id,
  opportunity.title,
  '/freelance/opportunities/' || opportunity.id,
  'system',
  'Opportunity history baseline at stage ' || opportunity.stage,
  jsonb_build_object('from', null, 'to', opportunity.stage, 'baseline', true),
  opportunity.created_at,
  now()
from opportunities opportunity;

insert into activities (
  subject_type,
  subject_id,
  subject_label,
  subject_path,
  kind,
  body,
  metadata,
  occurred_at,
  created_at
)
select
  'application',
  application.id,
  coalesce(application.job_snapshot->>'title', 'Application'),
  '/tracker',
  'system',
  'Application history baseline at status ' || application.status,
  jsonb_build_object('from', null, 'to', application.status, 'baseline', true),
  application.created_at,
  now()
from applications application;

create or replace function prevent_activity_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Activities are append-only';
end;
$$;

create trigger activities_prevent_update
before update on activities
for each row execute function prevent_activity_update();

create or replace function enforce_activity_delete_window()
returns trigger
language plpgsql
as $$
begin
  if old.created_at < now() - interval '10 minutes' then
    raise exception 'Activity delete window has expired';
  end if;
  return old;
end;
$$;

create trigger activities_delete_window
before delete on activities
for each row execute function enforce_activity_delete_window();

create or replace function record_opportunity_stage_change()
returns trigger
language plpgsql
as $$
declare
  organization_name text;
begin
  if new.stage is distinct from old.stage then
    select name into organization_name from organizations where id = new.organization_id;
    insert into activities (
      subject_type,
      subject_id,
      subject_label,
      subject_path,
      kind,
      body,
      metadata,
      occurred_at
    ) values (
      'opportunity',
      new.id,
      new.title,
      '/freelance/opportunities/' || new.id,
      'stage_change',
      'Stage changed from ' || old.stage || ' to ' || new.stage,
      jsonb_build_object(
        'from', old.stage,
        'to', new.stage,
        'lost_reason', new.lost_reason,
        'organization', organization_name
      ),
      new.stage_changed_at
    );
  end if;
  return new;
end;
$$;

create trigger opportunities_record_stage_change
after update of stage on opportunities
for each row execute function record_opportunity_stage_change();

create or replace function record_application_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into activities (
      subject_type,
      subject_id,
      subject_label,
      subject_path,
      kind,
      body,
      metadata,
      occurred_at
    ) values (
      'application',
      new.id,
      coalesce(new.job_snapshot->>'title', 'Application'),
      '/tracker',
      'stage_change',
      'Application created with status ' || new.status,
      jsonb_build_object('from', null, 'to', new.status),
      new.created_at
    );
  elsif new.status is distinct from old.status then
    insert into activities (
      subject_type,
      subject_id,
      subject_label,
      subject_path,
      kind,
      body,
      metadata,
      occurred_at
    ) values (
      'application',
      new.id,
      coalesce(new.job_snapshot->>'title', 'Application'),
      '/tracker',
      'stage_change',
      'Status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status),
      new.status_changed_at
    );
  end if;
  return new;
end;
$$;

create trigger applications_record_status_change
after update of status on applications
for each row execute function record_application_status_change();

create trigger applications_record_created
after insert on applications
for each row execute function record_application_status_change();

create or replace function complete_archived_subject_tasks()
returns trigger
language plpgsql
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    update tasks
    set done_at = coalesce(done_at, new.archived_at), updated_at = new.archived_at
    where subject_type = tg_argv[0] and subject_id = new.id and done_at is null;
  end if;
  return new;
end;
$$;

create trigger organizations_complete_archived_tasks
after update of archived_at on organizations
for each row execute function complete_archived_subject_tasks('organization');

create trigger contacts_complete_archived_tasks
after update of archived_at on contacts
for each row execute function complete_archived_subject_tasks('contact');

create trigger opportunities_complete_archived_tasks
after update of archived_at on opportunities
for each row execute function complete_archived_subject_tasks('opportunity');

alter table settings
  add column if not exists task_notify_enabled boolean not null default false,
  add column if not exists task_digest_sent_on date;

alter table activities enable row level security;
alter table tasks enable row level security;
