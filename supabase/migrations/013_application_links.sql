alter table applications
  add column if not exists organization_id uuid references organizations(id);

create index if not exists applications_organization_idx
  on applications (organization_id)
  where organization_id is not null;

insert into activities (
  subject_type,
  subject_id,
  subject_label,
  subject_path,
  kind,
  body,
  metadata,
  occurred_at
)
select
  'opportunity',
  opportunity.id,
  opportunity.title,
  '/freelance/opportunities/' || opportunity.id,
  'system',
  'Metrics baseline recorded',
  jsonb_build_object(
    'metrics_baseline', true,
    'stage', opportunity.stage,
    'value_cents', opportunity.value_cents,
    'currency', opportunity.currency
  ),
  now()
from opportunities opportunity
where opportunity.archived_at is null;

create or replace function record_opportunity_value_change()
returns trigger
language plpgsql
as $$
begin
  if new.value_cents is distinct from old.value_cents
    or new.currency is distinct from old.currency then
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
      'system',
      'Opportunity value changed',
      jsonb_build_object(
        'old_value_cents', old.value_cents,
        'new_value_cents', new.value_cents,
        'old_currency', old.currency,
        'new_currency', new.currency
      ),
      new.updated_at
    );
  end if;
  return new;
end;
$$;

create trigger opportunities_record_value_change
after update of value_cents, currency on opportunities
for each row execute function record_opportunity_value_change();

