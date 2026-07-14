# KOBOLD

Personal job discovery and application workspace for Berlin, Germany, and
remote European or worldwide frontend opportunities.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

To run the complete UI without Supabase, Vercel, or live job sources, use:

```bash
npm run dev:fixtures
```

Fixture mode is development-only and authenticates a local fixture user. Do not
set `VITE_USE_FIXTURES=true` in a production environment.

For Vercel-style API routing locally:

```bash
npx vercel dev --local --listen 127.0.0.1:3001
```

Required local environment variables:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
APP_PASSWORD=
CRON_SECRET=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

No variable should be prefixed with `VITE_`.

## Supabase Setup

1. Create a Supabase project.
2. Run each SQL file in `supabase/migrations/` in filename order in the SQL editor.
   The current app requires migrations `002` through `007`; do not deploy API
   changes before applying them.
3. Create a private Storage bucket named `documents`.
4. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel project environment variables.

The browser never uses Supabase directly. All database and Storage access goes through `/api`.

## Notifications

KOBOLD checks every configured source in one scan every three hours. Migration
`006_job_fingerprints.sql` stores only deterministic IDs, source names, and
notification timestamps so alerts remain duplicate-safe without storing job
content before application.

Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then enable the combined digest
on the Settings page. The first scan creates a silent baseline. Later scans send
one message containing new target-profile jobs; failed sends and jobs that
exceed one Telegram message remain pending for the next scan.

## Listing Persistence

The Board and job detail fetch live listings from their sources through `/api`.
KOBOLD does not store or read job listings from Supabase. A complete listing
snapshot is saved only when you confirm **I applied**, so the Tracker remains
available even after the source listing disappears. Saved and dismissed listings
are kept only in the current browser.

## Application Filler Extension

KOBOLD includes a fill-only Chrome extension for common Greenhouse, Lever,
Ashby, and generic application forms. It fills recognized empty fields from the
KOBOLD profile, highlights manual-review fields, never overwrites existing
answers, and never submits the form.

Build and install it locally:

```bash
npm run build:extension
```

Load `extension/dist` as an unpacked extension. See
[`docs/EXTENSION.md`](docs/EXTENSION.md) for installation, use, privacy, and
verification details.

## Cron Setup

GitHub Actions runs the production scan every three hours:

```text
POST https://<app>.vercel.app/api/ingest?source=all
x-cron-secret: <CRON_SECRET>
```

`.github/workflows/job-scan.yml` uses the repository secret
`KOBOLD_CRON_SECRET`. It must match the production Vercel `CRON_SECRET`.
`vercel.json` runs one daily fallback scan at 07:23 UTC because Vercel Hobby
does not accept schedules that run more than once per day.

An external scheduler can call the same endpoint with `POST` and
`x-cron-secret: <CRON_SECRET>`. Configure one all-source job, not separate jobs
per source. A failed source is recorded independently and does not suppress
healthy-source results or the digest.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for release, scheduler, migration,
recovery, and rollback procedures.

## Verification

```bash
npm test
npm run typecheck
npm run typecheck:extension
npm run build
npm run build:extension
npm run test:sources
```

`npm run test:sources` makes live network calls and may return zero jobs for some sources.

## Deploy

1. Push the repo to GitHub.
2. Import it into Vercel as a Vite project.
3. Add all environment variables from `.env.example`.
4. Deploy.
5. Log in with `APP_PASSWORD`.
6. Apply migrations `006` and `007`, configure Telegram credentials, and enable alerts in Settings.
7. Add the matching `KOBOLD_CRON_SECRET` repository secret.
8. Run the **Job scan** workflow once to establish the silent baseline.
9. Run a Board refresh and confirm live listings and source coverage render.
