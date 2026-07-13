# Vue Job Hunter

Personal Vue.js job-hunting tool for Berlin and remote-Europe full-time roles.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

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
SCRAPERAPI_KEY=
APP_URL=
```

No variable should be prefixed with `VITE_`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_init.sql` in the SQL editor.
3. Create a private Storage bucket named `documents`.
4. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel project environment variables.

The browser never uses Supabase directly. All database and Storage access goes through `/api`.

## Telegram Setup

1. Create a bot with `@BotFather`.
2. Save the token as `TELEGRAM_BOT_TOKEN`.
3. Send a message to the bot.
4. Call `https://api.telegram.org/bot<token>/getUpdates`.
5. Save your chat id as `TELEGRAM_CHAT_ID`.

Notifications link to `APP_URL/jobs/:id`, so set `APP_URL` to the production Vercel URL.

## ScraperAPI

StepStone ingestion no-ops unless `SCRAPERAPI_KEY` is configured. Keep StepStone on the limited schedule below to preserve quota.

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
| `06:30`, `18:30` | `stepstone` |
| `04:00` | `lifecycle` |

`vercel.json` also defines a daily lifecycle cron as a fallback.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run test:sources
```

`npm run test:sources` makes live network calls and may return zero jobs for some sources. StepStone returns zero unless `SCRAPERAPI_KEY` is present.

## Deploy

1. Push the repo to GitHub.
2. Import it into Vercel as a Vite project.
3. Add all environment variables from `.env.example`.
4. Deploy.
5. Log in with `APP_PASSWORD`.
6. Configure cron-job.org jobs with `CRON_SECRET`.
7. Run a manual refresh from the Board and confirm ingest history in Settings.
