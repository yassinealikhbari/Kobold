# KOBOLD

Personal Vue.js job-hunting tool for Berlin and remote-Europe full-time roles.

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
   The current app requires migrations `002` through `006`; do not deploy API
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
one message containing new eligible jobs; failed sends and jobs that exceed one
Telegram message remain pending for the next scan.

## Listing Persistence

The Board and job detail fetch live listings from their sources through `/api`.
KOBOLD does not store or read job listings from Supabase. A complete listing
snapshot is saved only when you confirm **I applied**, so the Tracker remains
available even after the source listing disappears. Saved and dismissed listings
are kept only in the current browser.

## Cron Setup

`vercel.json` defines the production schedule:

```text
GET https://<app>.vercel.app/api/ingest?source=all
Authorization: Bearer <CRON_SECRET>
```

Schedule: `0 */3 * * *` (every three hours).

An external scheduler can call the same endpoint with `POST` and
`x-cron-secret: <CRON_SECRET>`. Configure one all-source job, not separate jobs
per source. A failed source is recorded independently and does not suppress
healthy-source results or the digest.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run test:sources
```

`npm run test:sources` makes live network calls and may return zero jobs for some sources.

## Deploy

1. Push the repo to GitHub.
2. Import it into Vercel as a Vite project.
3. Add all environment variables from `.env.example`.
4. Deploy.
5. Log in with `APP_PASSWORD`.
6. Apply migration `006`, configure Telegram credentials, and enable alerts in Settings.
7. Run `/api/ingest?source=all` once to establish the baseline.
8. Run a Board refresh and confirm live listings and source coverage render.
