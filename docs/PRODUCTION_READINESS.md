# Production Readiness

Use this checklist before the first production deployment and after any
environment, database, or scheduling change.

## Environment

- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured only in
  Vercel server environments.
- [ ] `SESSION_SECRET`, `APP_PASSWORD`, and `CRON_SECRET` are unique random
  values and are not committed to the repository.
- [ ] `APP_URL` is the production HTTPS URL without a trailing slash.
- [ ] `OPENAI_API_KEY` is configured only when cover-letter generation is
  enabled.
- [ ] Telegram credentials are configured only when notifications are enabled.

## Supabase

- [ ] Every file in `supabase/migrations/` has been applied in filename order.
  The current production API requires `002_application_status_timestamp.sql`,
  `003_ingest_health.sql`, `004_board_explanations.sql`,
  `005_application_job_snapshots.sql`, `006_job_fingerprints.sql`, and
  `007_profile_experience.sql`. Missing `002` breaks tracker status updates;
  missing `005` prevents submitted applications from saving their listing
  snapshots; missing `006` disables duplicate-safe notifications; missing `007`
  prevents the experience baseline from being saved.
- [ ] The `documents` bucket exists and is private.
- [ ] Row level security is enabled on every application table.
- [ ] A signed CV URL works only for an authenticated session.

## Ingest And Scheduling

- [ ] The all-source scan reports every configured adapter and records failures independently.
- [ ] The GitHub **Job scan** workflow runs `source=all` every three hours with
  `KOBOLD_CRON_SECRET` matching Vercel's `CRON_SECRET`.
- [ ] The daily Vercel Hobby-compatible fallback cron is registered.
- [ ] The first scan establishes a silent fingerprint baseline.
- [ ] A later scan sends one combined Telegram digest for new jobs only.
- [ ] Settings shows a clear error for one intentionally failed source request.

## User Workflows

- [ ] Login, logout, board refresh, save, dismiss, restore, and tracker status
  updates work in production.
- [ ] A PDF CV can be uploaded, downloaded, and replaced.
- [ ] Cover-letter generation works when OpenAI is enabled and returns a useful
  configuration error when it is not.
- [ ] Telegram delivery has been tested when notifications are enabled.

## Application Filler Extension

- [ ] `extension/dist` was produced by `npm run build:extension` from the same
  release commit.
- [ ] Profile sync succeeds only while signed in to the production KOBOLD app.
- [ ] Greenhouse, Lever, Ashby, and the generic fixture fill recognized empty
  fields without replacing an existing answer.
- [ ] CV, cover letter, compensation, authorization, visa, sponsorship, and
  demographic fields remain manual.
- [ ] Filling does not click a button, submit a form, or navigate away from the
  application page.
- [ ] Clearing the synced profile removes the locally stored extension data.

## Release Verification

- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run typecheck:extension` passes.
- [ ] `npm run build` passes.
- [ ] `npm run build:extension` passes and all four PNG icon sizes are present.
- [ ] `npm run test:sources` has been reviewed; source-specific zero results are
  understood before release.
- [ ] `npm audit --omit=dev` reports zero production vulnerabilities; any
  remaining development-only advisory is recorded with its upstream package.
- [ ] Vercel function logs contain no unexpected `api_error` events after smoke
  testing.
