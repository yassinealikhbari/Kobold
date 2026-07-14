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
  ) as application_snapshot;
```

All three values must be `true`.

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
