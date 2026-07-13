# KOBOLD — Technical Specification & Build Plan

Personal job-hunting tool for Yassine Alikhbari. Aggregates full-time Vue.js roles (Berlin or remote-within-Europe), filters out German-required and junior listings, notifies via Telegram, and provides a prefill-and-confirm apply flow with LLM-generated cover letters and a kanban application tracker.

**Locked decisions**

| Area | Decision |
|---|---|
| Frontend | Vue 3 SPA (Vite, TypeScript, `<script setup>`, Pinia, Vue Router) |
| Backend | Vercel serverless functions in `/api` (Node 20, TypeScript) |
| Hosting | Vercel |
| Database & files | Supabase (Postgres + Storage for CV PDF) — accessed **only** from serverless functions via service-role key |
| Auth | Single shared password → signed JWT in HttpOnly cookie |
| Sources | Arbeitnow API, VueJobs feed, BerlinStartupJobs, GermanTechJobs, Working Nomads API, Remote OK API |
| Listings | Live source fetch through `/api`; never persisted in Supabase |
| Cover letters | OpenAI `gpt-4o-mini`, generated per job from profile + job description, editable before use |
| CV | One static PDF in Supabase Storage, served via signed URL |
| Apply flow | Prep panel (copy-ready fields + letter + CV) that opens the ATS form; no auto-submit |
| Tracking | Kanban: applied → interviewing → offer / rejected, with notes, dates, and a job snapshot saved on submission |
| Notifications | Disabled while listings are live-only; source health remains available |
| Filters | Vue/Nuxt relevance; Berlin OR remote-in-Europe; full-time; mid+senior (junior excluded); German-required listings excluded |

---

## 1. Architecture

```
Browser (Vue 3 SPA)
   │  fetch, cookie-authenticated
   ▼
Vercel /api functions (TypeScript)
   ├─ auth.ts          login / logout / session
   ├─ jobs.ts          list + detail + dismiss
   ├─ ingest.ts        per-source ingestion (cron or manual)
   ├─ profile.ts       profile CRUD + CV upload/signed URL
   ├─ applications.ts  tracker CRUD
   ├─ cover-letter.ts  OpenAI generation
   └─ notify.ts        Telegram sender (called by ingest)
   │  service-role key (server only)
   ▼
Supabase (Postgres + Storage bucket `documents`)

External: Arbeitnow, VueJobs RSS, BerlinStartupJobs RSS,
GermanTechJobs, Working Nomads API,
Remote OK API, OpenAI API, Telegram Bot API,
cron-job.org (scheduler — see §6.3)
```

Key principle: **the browser never talks to Supabase or any third party directly.** Everything goes through `/api`, which enforces auth. The SPA is deployed as static assets on the same Vercel project, so no CORS setup is needed.

### Repository layout

```
/
├─ api/                      # Vercel functions (one file = one route)
│  ├─ _lib/                  # shared server code (underscore = not routed)
│  │  ├─ db.ts               # Supabase server client
│  │  ├─ auth.ts             # JWT sign/verify, requireAuth() guard
│  │  ├─ normalize.ts        # Job normalizer, dedupe key, scoring
│  │  ├─ filters.ts          # relevance / location / language / seniority
│  │  ├─ telegram.ts
│  │  └─ sources/
│  │     ├─ types.ts         # SourceAdapter interface, RawJob
│  │     ├─ arbeitnow.ts
│  │     ├─ vuejobs.ts
│  │     ├─ berlinstartupjobs.ts
│  │     ├─ germantechjobs.ts
│  │     ├─ workingnomads.ts
│  │     └─ remoteok.ts
│  ├─ auth/login.ts  auth/logout.ts  auth/session.ts
│  ├─ jobs/index.ts  jobs/[id].ts
│  ├─ ingest.ts               # ?source=<name>&secret=<CRON_SECRET>
│  ├─ profile/index.ts  profile/cv.ts
│  ├─ applications/index.ts  applications/[id].ts
│  └─ cover-letter.ts
├─ src/                      # Vue SPA
│  ├─ main.ts  App.vue  router.ts
│  ├─ stores/   (auth, jobs, profile, applications)
│  ├─ pages/    Login.vue  Board.vue  JobDetail.vue  Profile.vue  Tracker.vue  Settings.vue
│  ├─ components/ JobCard.vue  FilterBar.vue  ApplyPanel.vue  KanbanColumn.vue  SyncStatus.vue
│  └─ lib/api.ts             # typed fetch wrapper (handles 401 → redirect to login)
├─ supabase/migrations/001_init.sql
├─ vercel.json
├─ .env.example
└─ package.json
```

---

## 2. Data model (Supabase Postgres)

`jobs` is legacy-only and is not read or written by the product. Source results
exist only for the request that fetched them. New application records own the
listing snapshot captured when the user confirms submission.

```sql
create table jobs (
  id            uuid primary key default gen_random_uuid(),
  dedupe_key    text unique not null,
  title         text not null,
  company       text not null,
  location      text,                          -- raw location string
  workplace     text not null default 'unknown'
                check (workplace in ('remote','hybrid','onsite','unknown')),
  url           text not null,                 -- listing page
  apply_url     text,                          -- direct ATS link when known
  ats           text,                          -- greenhouse|lever|workable|personio|ashby|other|null
  sources       text[] not null,               -- e.g. {arbeitnow, vuejobs}
  tags          text[] not null default '{}',
  description_html text,
  description_text text,                       -- stripped, for filtering/LLM
  seniority     text check (seniority in ('mid','senior','mixed','unknown')),
  german_required boolean not null default false,
  salary_text   text,
  score         int not null default 0,
  posted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  status        text not null default 'active'
                check (status in ('active','stale','expired','dismissed'))
);
create index jobs_status_score_idx on jobs (status, score desc, posted_at desc);

create table applications (
  id            uuid primary key default gen_random_uuid(),
  job_key       text unique not null,
  job_snapshot  jsonb not null,
  status        text not null default 'applied'
                check (status in ('saved','applied','interviewing','offer','rejected')),
  cover_letter  text,
  notes         text,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
                                                -- one application per live listing
);

create table profile (                          -- single-row table
  id            int primary key default 1 check (id = 1),
  full_name     text, email text, phone text,
  location      text, linkedin text, github text, portfolio text,
  summary       text,                           -- 2-3 sentence pitch used in letters
  skills        text[] default '{}',
  languages     jsonb default '[]',             -- [{lang, level}]
  work_history  jsonb default '[]',             -- [{company, role, from, to, highlights[]}]
  cv_path       text,                           -- storage path in bucket `documents`
  updated_at    timestamptz not null default now()
);

create table ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  found         int default 0,                  -- raw items fetched
  matched       int default 0,                  -- passed filters
  inserted      int default 0,                  -- new jobs
  error         text
);

create table settings (                          -- single-row table
  id                int primary key default 1 check (id = 1),
  notify_enabled    boolean not null default true,
  min_score_notify  int not null default 3,
  updated_at        timestamptz not null default now()
);
```

**RLS:** enable RLS on all tables with **no policies** (deny-all). The service-role key used by `/api` bypasses RLS; this guarantees nothing is readable if the anon key ever leaks. Storage bucket `documents` is private; CV access only via short-lived signed URLs created server-side.

---

## 3. Source adapters

Common interface — every adapter is isolated, failures never break other sources:

```ts
interface RawJob {
  title: string; company: string; location?: string;
  url: string; applyUrl?: string; tags?: string[];
  descriptionHtml?: string; remote?: boolean;
  postedAt?: string; salaryText?: string;
}
interface SourceAdapter {
  name: string;
  fetchJobs(): Promise<RawJob[]>;   // throws on total failure; ingest catches
}
```

| # | Source | Method | Endpoint / notes |
|---|---|---|---|
| 1 | **Arbeitnow** | Public JSON API, no key | `GET https://www.arbeitnow.com/api/job-board-api?page=N`, pages 1–5, 500 ms delay between pages. Fields: `slug, company_name, title, description (HTML), remote (bool), url, tags[], job_types[], location, created_at (unix seconds)`. Pre-filter server-side: keep items matching Vue regex (§4.1) before normalizing. |
| 2 | **VueJobs** | RSS feed | Try `https://vuejobs.com/feed` then `https://app.vuejobs.com/feed/posts`. Parse `<item>` blocks (title, link, pubDate, description). Title is usually `"{role} at {company}"` — split on last `" at "`; if no match, company = `"(see listing)"`. All items are Vue-relevant by definition; still apply location/language/seniority filters. |
| 3 | **BerlinStartupJobs** | WordPress RSS | `GET https://berlinstartupjobs.com/?s=vue&feed=rss2`. Standard RSS. Company often embedded in title (`"Company: Role"` or `"Role // Company"`) — parse best-effort, fallback `"(see listing)"`. All results are Berlin by definition. |
| 4 | **GermanTechJobs** | Scrape | `GET https://germantechjobs.de/jobs/Vue/Berlin` and `/jobs/Vue/Remote`. Parse `application/ld+json` `JobPosting` entries (the site embeds them). If markup changes and nothing parses, return `[]` + log. |
| 5 | **Working Nomads** | Public JSON API | `GET https://www.workingnomads.com/api/exposed_jobs/` → array of `{url, title, description, company_name, category_name, tags, location, pub_date}`. Keep items where tags/title match Vue regex AND location matches Europe heuristic (§4.2). |
| 6 | **Remote OK** | Public JSON API | `GET https://remoteok.com/api` with `User-Agent` header set (they require one). **First array element is a legal-notice object — skip it.** Fields: `position, company, tags[], location, url, date, salary_min/max`. Keep items where tags include `vue`/`nuxt` AND location matches Europe heuristic. Their ToS requires linking back to the Remote OK URL — always use their `url` as the listing link. |

**Shared adapter rules**

- Every HTTP call: 10 s timeout via `AbortController`, single retry with 1 s backoff on 5xx/network errors; no retry on 4xx.
- Strip HTML → `description_text` (decode entities, drop tags/scripts). Truncate `description_text` to 20 000 chars, `description_html` to 100 000.
- Missing/unparseable dates → `posted_at = null` (never fake dates; sorting falls back to `first_seen_at`).
- Empty title or URL → drop item.
- `applyUrl` extraction: for description HTML containing links to `greenhouse.io | lever.co | workable.com | jobs.personio.de | ashbyhq.com | join.com`, take the first such link as `apply_url` and set `ats` accordingly.

---

## 4. Normalization, filtering, scoring, dedupe

### 4.1 Vue relevance

```
VUE_RE = /\b(vue(\.js|js)?|nuxt(\.js|js)?)\b/i
```
- Match in `title` or `tags` → relevant (strong).
- Match only in `description_text` → relevant (weak) **only if** title also matches `/(front.?end|full.?stack|web|software|javascript|typescript)/i`. (Avoids backend jobs that mention Vue in a stack dump. They still pass, they just need the description match + a plausibly-frontend title.)
- No match anywhere → discard.

### 4.2 Location / workplace

Evaluate in this order; first rule that fires wins:

1. `location` matches `/berlin/i` → **keep**, `workplace` from source flags else `onsite`.
2. Source says remote (`remote === true` or tags/location contain `remote`):
   - location/description matches `/(europe|emea|eu\b|cet|european|worldwide|anywhere|germany|deutschland)/i` → **keep**, `workplace = remote`.
   - location names only non-EU regions (`/(united states|usa|us only|canada|latam|americas|apac|asia|australia|india|africa)/i` with **no** Europe/worldwide match) → **discard**.
   - Remote with empty/unknown region → **keep** but score −1 (uncertain; badge "region unverified" in UI).
3. Location is another German/EU city with `hybrid`/`onsite` and no Berlin/remote → **discard**.
4. No location info at all → **keep** with score −1 and "location unknown" badge (common in RSS items; better to surface than silently drop).

Multi-location strings ("Hamburg, Berlin, Munich") count as Berlin if any segment matches rule 1.

### 4.3 Employment type

Discard if title/tags/type fields match `/(part.?time|teilzeit|internship|intern\b|praktikum|working student|werkstudent|freelance|contract\b|contractor|mini.?job)/i` **unless** they also explicitly say full-time (some posts say "full-time or contract" — keep those, badge "flexible"). Missing type info → assume full-time (most boards imply it).

### 4.4 Seniority

- Discard: `/(junior|entry.?level|graduate|trainee)/i` in title.
- `senior|staff|principal|lead` in title → `seniority = 'senior'` (kept — often negotiable at 4 yrs experience).
- `mid|intermediate` → `'mid'`. Both markers → `'mixed'`. Neither → `'unknown'` (kept).
- Never discard based on "X+ years" in description — too noisy; the score handles it (§4.6).

### 4.5 German-language requirement (filter OUT per decision)

Two-step:

1. **Description language detection.** Count occurrences of German stopwords (` der `, ` die `, ` das `, ` und `, ` für `, ` mit `, ` wir `, ` du `) vs English (` the `, ` and `, ` for `, ` with `, ` you `, ` we `) in the first 2 000 chars of `description_text` (lowercased, padded). German count > English count → listing is in German → `german_required = true` → **discard**.
2. **Explicit requirement in English listings.** Discard if description matches:
   `/(german|deutsch)\w*[^.!?\n]{0,60}(required|must|mandatory|essential|fluent|native|c1|c2|verhandlungssicher|fließend)/i` **or** `/(fluent|native|c1|c2|verhandlungssicher|fließend)[^.!?\n]{0,60}(german|deutsch)/i`
   **unless** the same sentence matches `/(plus|nice.to.have|bonus|advantage|beneficial|not required|optional|a plus)/i` (e.g. "German is a plus" survives).
3. `(m/w/d)`-style suffixes are **not** a German-requirement signal (English-language German postings use them routinely). Strip them during title normalization instead.

Discarded-as-German jobs are still stored with `german_required = true, status = 'dismissed'` rather than dropped — so the dedupe key prevents them re-appearing every cron run, and you can audit false positives from a "hidden jobs" view in Settings.

### 4.6 Score (sort order on the board)

Start at 0: +3 Vue/Nuxt in title · +2 tags contain vue/nuxt · +2 Berlin · +2 remote with explicit Europe/CET · +1 mentions TypeScript · +1 mentions Nuxt specifically · +1 `seniority` in (`mid`,`mixed`) · +1 salary info present · −1 region/location unverified · −2 description demands 7+ years (`/\b([7-9]|1[0-9])\+?\s*years?/i`). Clamp to [−3, 12]. Notification threshold uses `settings.min_score_notify` (default 3).

### 4.7 Dedupe

```
dedupe_key = slug(company) + '::' + slug(normalizedTitle)
```
- `normalizedTitle`: lowercase, strip gender suffixes `/\((m|f|w|d|x|h)[\/|,\s]*.*?\)/gi`, strip `senior|junior` prefixes? **No** — keep seniority in the key (a senior and mid posting of the same role are different jobs), strip punctuation, collapse whitespace.
- `slug(company)`: lowercase, strip legal suffixes (`gmbh|se|ag|inc|ltd|co\.? kg`), punctuation, whitespace.
- On conflict (`dedupe_key` exists): update `last_seen_at = now()`, merge `sources` (array union), fill any null fields (e.g. RSS item had no salary but API duplicate does), **never** downgrade `status` (a dismissed job stays dismissed) and never re-notify.
- Company unknown (`"(see listing)"`): fall back to `slug(hostname(url)) + '::' + slug(title)` — prevents cross-company collisions on generic titles.

### 4.8 Lifecycle

During each full ingest cycle, jobs whose `last_seen_at` < now − 7 days → `status = 'stale'` (badge "possibly filled"); < now − 21 days → `'expired'` (hidden by default filter). Exception: jobs with an application in any status other than `saved` are never auto-expired (you want the record). A stale job re-appearing in a source flips back to `active`.

---

## 5. API contract (all routes under `/api`, all require auth cookie except login and ingest-with-secret)

| Route | Method | Body / query | Returns |
|---|---|---|---|
| `/auth/login` | POST | `{password}` | Sets HttpOnly cookie `vjh_session` (JWT, 30-day exp, `Secure`, `SameSite=Lax`). 401 on wrong password. Constant-time compare. Rate-limit: after 5 failures within 15 min (in-memory Map keyed by IP), respond 429. |
| `/auth/logout` | POST | — | Clears cookie. |
| `/auth/session` | GET | — | `{authenticated: bool}` — SPA boot check. |
| `/jobs` | GET | `?workplace=&minScore=&q=&source=&sort=score|posted&page=` | Live, in-memory normalized source results. Page size 50. |
| `/jobs/[id]` | GET | Live job detail resolved from the sources using its dedupe key. |
| `/ingest` | POST | `?source=<name>` + header `x-cron-secret` **or** auth cookie | Source health and optional notifications only; it never writes listings. |
| `/profile` | GET / PUT | PUT: full profile object | Profile row. |
| `/profile/cv` | POST / GET | POST: multipart PDF (≤5 MB, `application/pdf` only) → stores to `documents/cv.pdf`, updates `profile.cv_path`. GET → `{url}` signed URL, 10 min expiry. | |
| `/applications` | GET / POST | POST: `{job, cover_letter?}` after confirmation | List / creates an `applied` row with an embedded job snapshot. |
| `/applications/[id]` | PATCH / DELETE | `{status?, notes?, cover_letter?}`; setting status to `applied` auto-sets `applied_at` if null | Updated row. |
| `/cover-letter` | POST | `{job, instructions?}` | `{letter}` — draft stays in the browser until application submission. |

**Auth implementation:** `requireAuth(req)` in `_lib/auth.ts` verifies the JWT (HS256, `SESSION_SECRET` env) and throws 401. Every handler except `login` and secret-authenticated `ingest` calls it first. The ingest secret comparison is constant-time.

**Cover letter prompt (server-side, `gpt-4o-mini`, temperature 0.7, max ~450 output tokens):**

```
System: You write concise, specific cover letters for software engineering
applications. 180-250 words, professional but warm, no clichés ("passionate",
"rockstar"), no fabricated experience. Structure: hook tied to the company's
product → 2 concrete matches between candidate experience and the role's
requirements → brief close. Output plain text only, no header/date block.

User: CANDIDATE PROFILE:\n{summary}\n\nSkills: {skills}\n
Work history:\n{work_history as bullet lines}\n\nLanguages: {languages}\n
JOB: {title} at {company}\n{description_text truncated to 6000 chars}\n
{instructions ? "Extra instructions: " + instructions : ""}
```

Edge cases: OpenAI failure → 502 with `{error}`; UI keeps a "retry" button and the panel remains usable (copy fields don't depend on the letter). Empty profile summary → 400 "complete your profile first" before calling OpenAI.

---

## 6. Ingestion & scheduling

### 6.1 Flow per source

```
POST /api/ingest?source=arbeitnow
  → insert ingest_runs row (started)
  → adapter.fetchJobs()                    // isolated try/catch
  → for each RawJob: relevance → location → type → seniority → language
  → normalize + score for source-health counts
  → finalize ingest_runs row (no listing persistence or notification)
  → finalize ingest_runs row (counts / error)
```

### 6.2 Schedule

Every 3 hours per source, staggered to avoid burst; lifecycle pass once daily:

```
:00  arbeitnow      :05 vuejobs        :10 workingnomads
:15  remoteok       :20 berlinstartupjobs   :25 germantechjobs
04:00 lifecycle
```

### 6.3 Scheduler — important Vercel constraint

**Vercel Hobby plan cron jobs are limited (max 2 crons, once-per-day granularity).** Therefore: use **cron-job.org** (free) as the scheduler — one scheduled HTTP job per source hitting `https://<app>.vercel.app/api/ingest?source=X` with header `x-cron-secret: $CRON_SECRET`. Keep a single daily Vercel cron for `source=lifecycle` as a belt-and-braces fallback (defined in `vercel.json`). If you later upgrade to Vercel Pro, move all schedules into `vercel.json` crons.

Concurrency guard: if an unfinished `ingest_runs` row for the same source is younger than 5 min, return 409 (prevents overlapping runs on scheduler retries).

---

## 7. Notifications

Notifications are disabled. A live-only listing feed has no durable source
fingerprint, so it cannot determine whether a listing is new without producing
duplicates. Ingest remains available for source-health diagnostics only.

---

## 8. Frontend (SPA) spec

**Global:** Pinia stores hydrate from `/api`; 401 responses anywhere → redirect to `/login`. Dark-mode-friendly neutral styling; system font stack; no UI library required (or PrimeVue if Codex prefers — implementer's choice). Dates displayed in Europe/Berlin timezone, relative ("3 h ago") with absolute tooltip.

### Pages

1. **/login** — password field, error state, redirects to `/`.
2. **/ (Board)** — filter bar (search text, workplace, source, min score, show stale toggle) + job cards sorted by score then `posted_at` (nulls last, falling back to `first_seen_at`). Card: title, company, location badges (`Berlin` / `Remote EU` / `region unverified`), source chips, score, relative date, quick actions: **Save**, **Dismiss**, **Open listing**. Header shows `SyncStatus` (last run per source, red icon + tooltip on failures) and a **Refresh** button (dropdown: all sources / single source) that fires manual ingests sequentially with progress.
3. **/jobs/:id (Detail)** — full sanitized description (render `description_html` through DOMPurify; fallback `description_text` in `<pre-wrap>`), all metadata, then the **Apply panel**:
   - Checklist of copy-ready fields (name, email, phone, LinkedIn, GitHub, portfolio, location, salary expectation placeholder) each with a copy button.
   - **Cover letter block**: "Generate" → calls `/cover-letter` (spinner, ~5 s), renders in an editable textarea, "Regenerate" with optional extra-instructions input, "Copy". Edits persist to the application row (debounced PATCH).
   - **CV block**: filename + "Download CV" (signed URL). Warning banner if no CV uploaded.
   - **ATS row**: detected ATS name (from `ats` field) + "Open application form" (opens `apply_url ?? url` in new tab).
   - **"Mark as applied"** button → sets application status, timestamps, moves job into tracker.
4. **/tracker** — kanban with 5 columns (saved / applied / interviewing / offer / rejected). Drag-and-drop between columns (PATCH on drop; optimistic update with rollback on failure). Card: title, company, days-in-column, note icon. Click → side panel with notes textarea, dates, letter, link to job detail.
5. **/profile** — form for all profile fields; work history and languages as repeatable rows; skills as tag input; CV upload (PDF only, 5 MB max, replace-in-place); "profile completeness" hints (summary + CV required for apply flow).
6. **/settings** — notifications toggle, min-score threshold, "hidden jobs" audit list (dismissed + german-filtered, with restore button), ingest run history table.

---

## 9. Environment variables

```
SUPABASE_URL=            SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=          # 32+ random bytes
APP_PASSWORD=            # your login password
CRON_SECRET=             # random; shared with cron-job.org
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=      TELEGRAM_CHAT_ID=
APP_URL=                 # https://<app>.vercel.app, used in Telegram links
```

`.env.example` committed; real values only in Vercel project settings + local `.env` (gitignored). Nothing prefixed `VITE_` — no secret ever reaches the client bundle.

---

## 10. Edge-case catalog (consolidated)

| # | Case | Handling |
|---|---|---|
| 1 | Source down / HTML changed | Adapter returns `[]`/throws → logged in `ingest_runs`, other sources unaffected, red badge in SyncStatus |
| 2 | Duplicate job across boards | Dedupe key merges; `sources[]` union; no duplicate notification |
| 3 | Same role reposted with (m/w/d) variants | Gender suffix stripped in normalized title → same key |
| 4 | "German is a plus" | Survives language filter (exception regex) |
| 5 | English posting, German-only form later | Not detectable upfront — user dismisses; note in README |
| 6 | Remote but US-only | Discarded by §4.2 rule 2b |
| 7 | Remote, region unspecified | Kept, −1 score, "region unverified" badge |
| 8 | No posted date (RSS) | `posted_at=null`, sort falls back to `first_seen_at` |
| 9 | Job disappears from source | Stale after 7 d, expired after 21 d; never for in-progress applications |
| 10 | Dismissed job re-ingested | Upsert never downgrades status; stays dismissed |
| 11 | Cron overlap / retry storms | 409 concurrency guard per source |
| 12 | Vercel Hobby cron limits | External scheduler (cron-job.org) + secret header |
| 13 | Optional scraping provider quota exhausted | Keep provider-backed sources out of the default source list unless a free/stable option is available |
| 14 | Remote OK legal-notice element | Skip first array item; keep their URL as listing link (ToS) |
| 15 | OpenAI down / over quota | 502 surfaced in panel; retry button; rest of panel functional |
| 16 | Job description huge | Truncation limits (§3 shared rules; 6 k chars into prompt) |
| 17 | XSS via job description | DOMPurify before render; text-only fallback |
| 18 | CV replaced while URL active | Signed URLs are short-lived (10 min); path stable (`cv.pdf`) |
| 19 | Wrong password brute force | Constant-time compare + IP rate limit + 30-day cookie |
| 20 | Two jobs, same title+company, different level | Seniority kept in dedupe key → distinct |
| 21 | Company missing (RSS) | Hostname fallback in dedupe key |
| 22 | Applied job expires from board | Tracker row + job record retained (FK, no auto-expire) |
| 23 | Telegram down | Error appended to run log; ingest still succeeds |
| 24 | >3 new jobs at once | Digest message instead of spam |
| 25 | Time zones | Store UTC, render Europe/Berlin |

---

## 11. Build phases — Codex prompts

Feed one phase at a time. Each is self-contained and ends with acceptance criteria. Keep this spec file in the repo root as `SPEC.md` and tell Codex to consult it (every prompt references the section numbers).

**Phase 0 — Scaffold.**
> Create a Vue 3 + TypeScript + Vite SPA with Vue Router and Pinia, plus a Vercel serverless `/api` directory (Node 20, TS). Follow the repository layout in SPEC.md §1. Add `vercel.json` (SPA rewrites so client routes fall back to index.html, one daily cron for `/api/ingest?source=lifecycle`), `.env.example` per §9, `.gitignore`. Add `supabase/migrations/001_init.sql` exactly per §2. Add typed `src/lib/api.ts` fetch wrapper that redirects to `/login` on 401. Empty page shells for the 6 pages in §8.
> **Accept when:** `npm run dev` serves the shell; `vercel dev` serves `/api/health` returning `{ok:true}`; SQL applies cleanly in Supabase.

**Phase 1 — Auth.**
> Implement §5 auth routes and `_lib/auth.ts` (HS256 JWT via `jose`, HttpOnly cookie `vjh_session`, 30-day expiry, Secure, SameSite=Lax), constant-time password compare, in-memory IP rate limit (5 fails/15 min → 429). `requireAuth` guard used by a sample protected route. Login page wired to store; router guard redirects unauthenticated users.
> **Accept when:** wrong password 401s, six rapid failures 429, correct password sets cookie and `/auth/session` returns authenticated, logout clears it.

**Phase 2 — Normalization & filter engine (pure functions + tests).**
> Implement `_lib/normalize.ts` and `_lib/filters.ts` exactly per SPEC.md §4 (relevance, location, employment type, seniority, German detection with the exception rules, score, dedupe key, ATS extraction from description links). Pure functions, no I/O. Add vitest unit tests covering every rule and edge cases #3, #4, #6, #7, #20, #21 from §10.
> **Accept when:** all tests pass; German-with-plus survives; US-only remote discarded; (m/w/d) titles collide on dedupe key.

**Phase 3 — Source adapters.**
> Implement the 6 adapters per SPEC.md §3 with the shared rules (timeout, retry, truncation, drop-empty). Arbeitnow, Working Nomads, Remote OK are JSON; VueJobs and BerlinStartupJobs parse RSS with a small hand-rolled or lightweight parser; GermanTechJobs parses JSON-LD. Each returns `RawJob[]`.
> **Accept when:** a local script `npm run test:sources` fetches each source live and prints counts; a failing source prints its error without crashing others.

**Phase 4 — Ingest pipeline.**
> Implement `/api/ingest` per §5/§6: secret-or-cookie auth, per-source invocation, ingest_runs logging, filter → normalize → upsert flow with the §4.7 conflict rules, lifecycle pass (`source=lifecycle`, §4.8), 409 concurrency guard. German-filtered jobs stored as dismissed per §4.5.
> **Accept when:** running arbeitnow twice inserts then only updates (`inserted=0` second run); lifecycle marks a synthetic old job stale; run history rows correct.

**Phase 5 — Jobs API + Board UI.**
> Implement `/api/jobs` list/detail/dismiss per §5 and the Board + JobDetail pages per §8 (filters, sorting with null-date fallback, badges, DOMPurify rendering, SyncStatus header, manual refresh dropdown firing sequential ingests).
> **Accept when:** board renders live data with working filters; dismiss hides a job and it survives re-ingest hidden; failed source shows red sync badge.

**Phase 6 — Profile + CV.**
> Implement `/api/profile` and `/api/profile/cv` per §5 (multipart PDF ≤5 MB to private Supabase bucket `documents`, signed URL GET) and the Profile page per §8 with repeatable work-history/language rows and completeness hints.
> **Accept when:** profile round-trips; non-PDF and >5 MB rejected with clear errors; CV downloads via signed URL; replacing CV keeps one file.

**Phase 7 — Apply flow + cover letters.**
> Implement `/api/cover-letter` per §5 (gpt-4o-mini, exact prompt from §5, 6 k char truncation, 400 without profile summary, 502 on OpenAI failure) and the Apply panel per §8 (copy fields, generate/regenerate/edit letter with debounced persistence, CV block, ATS row, mark-as-applied).
> **Accept when:** letter generates from real profile+job, edits persist, OpenAI-key-removed shows recoverable error, mark-as-applied timestamps and appears in tracker.

**Phase 8 — Tracker.**
> Implement `/api/applications` CRUD and the kanban Tracker page per §8: 5 columns, drag-and-drop with optimistic updates and rollback, side panel with notes (debounced), days-in-column, link back to job detail.
> **Accept when:** dragging persists across reload; rollback works when API forced to fail; one-application-per-job constraint enforced (409 handled in UI).

**Phase 9 — Telegram + Settings.**
> Implement `_lib/telegram.ts` and wire into ingest per §7 (new+scored jobs only, ≤3 individual messages else digest, plain text, failures logged not thrown). Settings page per §8: toggle, threshold, hidden-jobs audit with restore, run history table.
> **Accept when:** fresh matching job triggers a message linking to the app's detail page; 5 new jobs produce one digest; disabling toggle silences it.

**Phase 10 — Hardening & deploy.**
> Security/UX pass: verify no secrets in client bundle (`grep` dist for key fragments), DOMPurify coverage, empty/loading/error states on all pages, Lighthouse sanity. Write README: Supabase setup (SQL, bucket), BotFather walkthrough, Vercel env vars + deploy, cron-job.org schedule table from §6.2 with secret header. Deploy and configure schedules.
> **Accept when:** production URL requires login, cron-job.org runs appear in ingest history, Telegram fires from production, edge cases #10/#12/#19 manually verified.

---

## 12. Explicit non-goals (v1)

No auto-submit of forms (ToS/CAPTCHA risk — revisit as a browser extension later; the `ats` field already stored per job is the hook for it). No multi-user support. No LLM-tailored CVs (static PDF only; §Apply panel leaves room to add later). No LinkedIn/Indeed sources (aggressive anti-bot; the adapter interface makes them possible later). No mobile app — the SPA is responsive, Telegram covers push.
