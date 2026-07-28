# KOBOLD Operations

## Production Release

1. Apply every SQL file in `supabase/migrations/` in filename order.
2. Confirm the required Vercel variables from `.env.example` are present.
3. Confirm the GitHub Actions secret `KOBOLD_CRON_SECRET` matches Vercel's
   `CRON_SECRET`.
4. Run the release commands:

   ```bash
   npm ci
   npm test
   npm run typecheck
   npm run typecheck:extension
   npm run build
   npm run build:extension
   npm run test:sources
   ```

5. Deploy with `npx vercel deploy --prod`.
6. Smoke-test Board, Profile, Settings, Tracker, one job detail, and the
   extension fixture.
7. Run the **Job scan** GitHub workflow manually once and inspect its log.
8. Run the **Task digest** workflow once. It must send nothing while follow-up
   notifications are disabled.

The release audit currently reports no production dependency vulnerabilities.
Development-only advisories are inherited through `@vercel/node`; do not apply
the audit tool's forced downgrade. Reassess them when Vercel publishes a
compatible dependency update.

## Scheduling

`.github/workflows/job-scan.yml` performs the all-source scan every three hours.
GitHub schedules may start late during periods of high load. `vercel.json` adds
one daily scan at 07:23 UTC as a fallback that is compatible with Vercel Hobby.
Both schedules call the same idempotent endpoint, and the active-run lock plus
fingerprints prevent overlapping work and duplicate Telegram notifications.

`.github/workflows/task-digest.yml` calls `/api/task-digest` once each morning.
The endpoint is disabled by default and records the Berlin calendar date after
a successful send so retries cannot duplicate the same morning digest.

Rotate the shared scheduler secret in both systems at the same time:

```bash
npx vercel env update CRON_SECRET production
gh secret set KOBOLD_CRON_SECRET --repo yassinealikhbari/Kobold
```

Do not add a more frequent Vercel cron on Hobby: Vercel rejects schedules that
run more than once per day during deployment.

## Database Verification

Run this read-only query in the Supabase SQL editor:

```sql
select
  to_regclass('public.job_fingerprints') is not null as job_fingerprints,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile'
      and column_name = 'experience_years'
  ) as profile_experience_years,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name = 'job_snapshot'
  ) as application_snapshot,
  to_regclass('public.organizations') is not null as organizations,
  to_regclass('public.contacts') is not null as contacts,
  to_regclass('public.opportunities') is not null as opportunities,
  to_regclass('public.activities') is not null as activities,
  to_regclass('public.tasks') is not null as tasks,
  to_regclass('public.site_audits') is not null as site_audits,
  to_regclass('public.message_templates') is not null as message_templates,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name = 'organization_id'
  ) as application_organization_link;
```

All eleven values must be `true`.

## CRM Migration Order

Apply the CRM migrations only in this order, before deploying the API code that
first reads each schema change:

1. `008_crm_core.sql`
2. `009_opportunities.sql`
3. `010_activity_tasks.sql`
4. `011_site_audits.sql`
5. `012_message_templates.sql`
6. `013_application_links.sql`

All migrations are additive. Do not rename or remove an existing job-hunt table,
column, or route during a CRM release.

## Backup And Export

Supabase database backups are the recovery source for all server-side state.
Before the first CRM production release and before any later schema change:

1. Confirm the project's scheduled backups or point-in-time recovery are active
   for the production database.
2. Confirm the backup includes `organizations`, `contacts`, `opportunities`,
   `activities`, `tasks`, `site_audits`, `message_templates`, and the updated
   `applications` table.
3. Download one authenticated CSV export for each CRM entity from **Metrics**
   and open it to verify headers, UTF-8 text, and representative rows. CSV is an
   operational portability copy, not a replacement for the database backup.
4. Record the backup timestamp and deployed commit in the release log.

For recovery, restore the database into a separate Supabase project first,
apply only migrations newer than the restored backup, and verify the query in
**Database Verification** before changing production environment variables.
Never import CSV over the production database as an automated rollback.

## Recovery

- **One source fails:** inspect Settings and rerun that source. Healthy sources
  still return jobs and participate in the combined scan.
- **A scan returns 409:** another scan started within five minutes. Let it
  finish; the next scheduled run retries normally.
- **No Telegram message on the first run:** this is expected. The first scan
  establishes a silent fingerprint baseline.
- **Telegram delivery fails:** fingerprints remain pending and retry on the next
  combined scan.
- **A source floods irrelevant jobs:** use Source and Profile filters, inspect
  source diagnostics, then update normalization tests before changing a hard
  eligibility rule.
- **Deployment regression:** use a Vercel instant rollback for the app, then
  redeploy the intended `vercel.json`; rolling back a deployment does not roll
  back active cron configuration.
- **Extension regression:** reload the previous unpacked `extension/dist`
  build. The extension has no server-side state and never submits forms.
