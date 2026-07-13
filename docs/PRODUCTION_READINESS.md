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
- [ ] The `documents` bucket exists and is private.
- [ ] Row level security is enabled on every application table.
- [ ] A signed CV URL works only for an authenticated session.

## Ingest And Scheduling

- [ ] Each external source has completed one successful manual ingest.
- [ ] The lifecycle pass has completed successfully.
- [ ] The production cron provider is configured with the correct source URL and
  secret header.
- [ ] Vercel Cron uses its supported authorization contract for the lifecycle
  endpoint.
- [ ] Settings shows a clear error for one intentionally failed source request.

## User Workflows

- [ ] Login, logout, board refresh, save, dismiss, restore, and tracker status
  updates work in production.
- [ ] A PDF CV can be uploaded, downloaded, and replaced.
- [ ] Cover-letter generation works when OpenAI is enabled and returns a useful
  configuration error when it is not.
- [ ] Telegram delivery has been tested when notifications are enabled.

## Release Verification

- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:sources` has been reviewed; source-specific zero results are
  understood before release.
- [ ] Vercel function logs contain no unexpected `api_error` events after smoke
  testing.
