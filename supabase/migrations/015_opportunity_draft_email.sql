-- Per-opportunity drafted outreach email, extracted from the Clay CSV import.
-- No template involved: each opportunity carries its own subject/body, editable
-- before sending via the user's own mail client.
alter table opportunities
  add column if not exists draft_email_subject text,
  add column if not exists draft_email_body text;
