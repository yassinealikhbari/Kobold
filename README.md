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
   The current app requires migrations `002`, `003`, `004`, and `005`; do not deploy
   API changes before applying them.
3. Create a private Storage bucket named `documents`.
4. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel project environment variables.

The browser never uses Supabase directly. All database and Storage access goes through `/api`.

## Notifications

Scheduled source probes currently record source health only. Notifications are
intentionally disabled because KOBOLD no longer stores source fingerprints and
therefore cannot identify a genuinely new listing without sending duplicates.

## Listing Persistence

The Board and job detail fetch live listings from their sources through `/api`.
KOBOLD does not store or read job listings from Supabase. A complete listing
snapshot is saved only when you confirm **I applied**, so the Tracker remains
available even after the source listing disappears. Saved and dismissed listings
are kept only in the current browser.

## Cron Setup

Use cron-job.org for source ingestion. Every job should call:

```text
POST https://<app>.vercel.app/api/ingest?source=<source>
x-cron-secret: <CRON_SECRET>
```

Schedule:

| Time | Source |
|---|---|
| `:00` | `arbeitnow` |
| `:05` | `vuejobs` |
| `:10` | `workingnomads` |
| `:15` | `remoteok` |
| `:20` | `berlinstartupjobs` |
| `:25` | `germantechjobs` |
| `04:00` | `lifecycle` |

`vercel.json` defines the daily lifecycle cron. Vercel invokes it with `GET`
and `Authorization: Bearer <CRON_SECRET>`; no extra header configuration is
needed for that lifecycle request.

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
6. Configure cron-job.org jobs with `CRON_SECRET` if you want source-health checks.
7. Run a Board refresh and confirm live listings render.
