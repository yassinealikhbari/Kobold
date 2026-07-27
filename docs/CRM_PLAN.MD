# KOBOLD CRM Plan — Freelance & Job Hunt Workspace

> Extends [`GOLD_MINE_REBUILD_PLAN.md`](GOLD_MINE_REBUILD_PLAN.md). Job discovery
> rules, persistence rules, and release gates defined there remain in force and
> are not modified by this plan. Operational procedures stay in
> [`OPERATIONS.md`](OPERATIONS.md).

## Outcome

KOBOLD is live and in daily use for job hunting. This plan adds a **Freelance**
mode alongside it: prospects, opportunities, and outreach for client work. The
existing discovery inbox, apply flow, application tracker, Telegram scan, and
extension are not modified. Contacts, activity history, and follow-ups are
shared, so a single view answers "what needs my attention today" across both.

**This plan is strictly additive to a running production app.** Every phase is
independently deployable, every migration adds tables or nullable columns only,
and no phase alters an existing route, table, or column until phase 6 — which
adds one nullable foreign key. If a phase is abandoned halfway, the live job-hunt
workflow is unaffected.

## Locked Decisions

| Area | Decision |
|---|---|
| Access | Unchanged: single shared password, signed JWT in HttpOnly cookie, single-owner deployment |
| Public surface | None. No public pages, no inbound forms in this plan |
| Future inbound | Data model must not block it: every lead carries an origin field that already permits `inbound` |
| Data access | Unchanged: browser never touches Supabase; all access through `/api` with service-role key and deny-all RLS |
| Structure | One app, two modes, shared entities. Not two apps, not two databases |
| Job side | `applications`, discovery, extension, and Telegram scan behavior are not refactored in phases 0–3 |
| Lead capture | Manual entry plus URL enrichment. No marketplace scraping, no bulk business scanning in v1 |
| Money | Opportunity values are stored but no invoicing, time tracking, or accounting |
| Deletion | CRM entities are archived by default. History is retained and open tasks are completed when their subject is archived |
| Stack | Unchanged: Vue 3 + Vite + Pinia SPA, Vercel functions in `/api`, Supabase Postgres + Storage |

## Domain Model

Five new concepts. Existing tables are extended, never replaced.

- **Organization** — a business. A freelance prospect (Cavatappi, RE Cucina) or,
  later, an employer. Holds website, district/postcode, industry, language, and
  status.
- **Contact** — a person, optionally attached to an organization. Holds preferred
  language, so outreach in Italian versus German is an explicit property.
- **Opportunity** — a potential piece of paid work. Owns pipeline stage, value,
  currency, confidence, and expected close date.
- **Activity** — an immutable record of something that happened: note, visit,
  DM, email, call, proposal sent, status change. Polymorphic, so it attaches to
  an organization, contact, opportunity, or an existing job application.
- **Task** — one next action with a due date. Also polymorphic. Tasks are what
  the shared Today view reads.

Two supporting concepts arrive later:

- **Site audit** — a stored technical snapshot of a prospect's current website
  (phase 4), used as pitch evidence.
- **Message template** — reusable outreach text with language variants
  (phase 5).

### Pipeline Stages

Opportunity stages are fixed and ordered: `lead` → `contacted` → `conversation`
→ `proposal` → `won` / `lost`. `lost` requires a reason from a fixed list
(`no budget`, `no response`, `timing`, `chose someone else`, `not a fit`,
`business closed`). Reasons are reportable; free text alone is not.
Lost opportunities may be reopened. Reopening records a new stage transition
and clears the mutable `lost_reason` field while preserving the historical loss
event.

## Information Architecture

```
Top-level mode switch:  [ Freelance ]  [ Job Hunt ]     Shared: Today · Profile · Settings

Freelance
  /freelance                  Pipeline board (opportunities by stage)
  /freelance/organizations    List + filters (district, status, language, has-website)
  /freelance/organizations/:id  Detail: contacts, opportunities, activity, tasks, audit
  /freelance/contacts         List
  /freelance/contacts/:id     Detail: activity, tasks, and contact fields
  /freelance/templates        Outreach template variants by language
  /freelance/metrics          Event-derived pipeline metrics and CSV export
  /freelance/opportunities/:id  Detail: stage, value, activity, tasks, linked docs

Job Hunt  (existing routes, unchanged)
  /                           Discovery inbox
  /jobs/:id                   Job detail + apply panel
  /tracker                    Application kanban

Shared
  /today                      Overdue and upcoming tasks from both modes
  /profile  /settings         Existing pages
```

The mode switch persists in local storage and determines the landing route.
Deep links always win over the remembered mode.

## Data Changes

Migrations continue from `007`, which is already applied in production. Each new
migration is additive; none alters or drops an existing column. Apply the
migration in Supabase **before** deploying the API code that reads it, per the
existing deployment rule in `OPERATIONS.md`.

```
008_crm_core.sql          organizations, contacts
009_opportunities.sql     opportunities
010_activity_tasks.sql    activities, tasks
011_site_audits.sql       site_audits
012_message_templates.sql message_templates
013_application_links.sql applications.organization_id (nullable FK)
```

Sketch of the core tables:

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  district text,                 -- 'Graefekiez'
  postcode text,                 -- '10967'
  country text default 'DE',
  language text default 'de'     -- outreach language: de|it|en
    check (language in ('de','it','en')),
  origin text not null default 'manual'
    check (origin in ('manual','walk_by','referral','inbound','event','other')),
  status text not null default 'prospect'
    check (status in ('prospect','active','dormant','closed','disqualified')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  full_name text not null,
  role text,
  email text, phone text, instagram text, linkedin text,
  language text check (language in ('de','it','en')),
  is_primary boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,                    -- 'One-page site for catering pivot'
  stage text not null default 'lead'
    check (stage in ('lead','contacted','conversation','proposal','won','lost')),
  value_cents int, currency text default 'EUR',
  confidence int check (confidence between 0 and 100),
  expected_close date,
  lost_reason text,
  archived_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type in ('organization','contact','opportunity','application')),
  subject_id uuid not null,
  kind text not null
    check (kind in ('note','visit','dm','email','call','meeting','proposal','stage_change','system')),
  body text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index activities_subject_idx on activities (subject_type, subject_id, occurred_at desc);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  subject_type text check (subject_type in ('organization','contact','opportunity','application')),
  subject_id uuid,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_open_due_idx on tasks (done_at, due_at);
```

Activities are append-only: no update route, delete only within 10 minutes of
creation. Stage changes write an activity automatically; the timeline is the
audit trail, not the notes field.

Organizations, contacts, and opportunities use archive/restore semantics in
normal UI flows. Archiving retains activity history, hides the entity from
default queries, and completes its open tasks. Hard deletion is not exposed by
the application.

RLS stays enabled with no policies on every new table.

## API Surface

New routes follow existing conventions: cookie auth via `requireAuth`,
server-side validation, no client Supabase access.

| Route | Methods | Notes |
|---|---|---|
| `/api/organizations` | GET, POST | Filters: status, district, language, has_website, q |
| `/api/organizations/[id]` | GET, PATCH, DELETE | DELETE archives; GET returns contacts, opportunities, recent activity, open tasks |
| `/api/contacts` | GET, POST | Filter by organization |
| `/api/contacts/[id]` | GET, PATCH, DELETE | DELETE archives |
| `/api/opportunities` | GET, POST | Filter by stage, organization; sort by stage_changed_at |
| `/api/opportunities/[id]` | GET, PATCH, DELETE | DELETE archives; stage change writes an activity and sets `stage_changed_at` |
| `/api/activities` | GET, POST | GET requires subject_type + subject_id |
| `/api/tasks` | GET, POST | GET supports `?scope=today\|overdue\|upcoming\|all` |
| `/api/tasks/[id]` | PATCH, DELETE | PATCH toggles `done_at` |
| `/api/audit` | POST | Phase 4. `{url}` → stored site audit |
| `/api/templates` | GET, POST | Phase 5 |
| `/api/templates/[id]` | PATCH, DELETE | DELETE archives a template variant |
| `/api/metrics` | GET | Event-derived freelance pipeline metrics |
| `/api/export` | GET | CSV export selected with `?entity=` |

---

## Phase 0: Shared Shell And Navigation

**Delivers the two-mode structure before any CRM feature exists. Ships to
production with empty freelance screens — safe, because nothing in the live
job-hunt path changes.**

### Scope

1. Add a mode concept to the router: `freelance` and `jobs`. Existing job routes
   keep their current paths so no bookmark or extension assumption breaks.
2. Add a persistent top-level mode switch and per-mode secondary navigation.
   Shared items (Today, Profile, Settings) sit outside the switch.
3. Persist the active mode in local storage; deep links override it.
4. Create empty, reachable page shells for every freelance route in the IA above,
   each with a real empty state rather than a placeholder string.
5. Extract the layout, navigation, page header, empty state, and list/detail
   shell into shared components so both modes stay visually identical.
6. Add fixture data for freelance routes so `npm run dev:fixtures` renders the
   full shell without Supabase.
7. Mobile: the mode switch and both navigations work at 320px.

### Acceptance Criteria

- Every route in the IA renders, is linkable, and survives reload in the correct
  mode.
- No existing job-side route, store, or API call changes behavior.
- Fixture mode renders all freelance shells with no network calls.
- Keyboard navigation reaches the mode switch and every nav item.

### Tests

- Router tests for mode resolution, persistence, and deep-link override.
- Visual regression at mobile and desktop for both modes.
- Existing job-side test suite passes unchanged.

### Commit

`feat: add two-mode workspace shell`

---

## Phase 1: Organizations And Contacts

### Scope

1. Migration `008_crm_core.sql`.
2. `/api/organizations` and `/api/contacts` with full server-side validation:
   URL shape, postcode format, enum values, field lengths, duplicate-name warning
   (warn, never block).
3. Organization list with filters and search; organization detail with inline
   contact management.
4. Quick-add flow: name plus website is enough to create a record. Everything
   else is optional and editable later.
5. Language field surfaced prominently on contacts, because it determines
   outreach language.

### Acceptance Criteria

- An organization can be created in under fifteen seconds from the list view.
- Archiving an organization preserves its contacts and history. Archived
  records are hidden from default queries and can be restored.
- Invalid payloads return field-level errors the UI renders next to the input.

### Tests

- Validation matrix per field; cascade and set-null behavior; filter and search
  correctness including SQL-escaping of `q`.

### Commit

`feat: add organizations and contacts`

---

## Phase 2: Opportunity Pipeline

### Scope

1. Migration `009_opportunities.sql`.
2. `/api/opportunities` with stage transition rules: any stage may move to any
   other, `lost` requires a reason, transitions stamp `stage_changed_at`.
3. Pipeline board: six columns, drag-and-drop with optimistic update and
   rollback, plus a keyboard- and touch-accessible stage selector.
4. Card shows organization, title, value, days in stage, and open-task count.
   Days-in-stage past a threshold renders as a warning, not a color-only cue.
5. Pipeline header totals: open value, weighted value by confidence, count per
   stage.
6. Opportunity detail with editable fields and linked organization.

### Acceptance Criteria

- Dragging persists across reload; a forced API failure rolls the card back.
- Moving to `lost` without a reason is rejected in both API and UI.
- Board and totals stay correct while filtering.

### Tests

- Transition matrix; optimistic rollback; weighted-value calculation; keyboard
  stage change.

### Commit

`feat: add freelance opportunity pipeline`

---

## Phase 3: Activity Timeline, Tasks, And Today

**This is the phase that makes the tool worth opening daily.**

### Scope

1. Migration `010_activity_tasks.sql`.
2. `/api/activities` append-only with the 10-minute delete window.
3. `/api/tasks` with scope queries and completion toggling.
4. Timeline component rendered on organization, contact, opportunity, and — via
   the polymorphic subject — existing job application detail.
5. Automatic activities for opportunity stage changes and application status
   changes. Manual activities for note, visit, DM, email, call, meeting, proposal.
6. Task creation inline from any timeline, with quick due-date presets
   (tomorrow, in three days, next week).
7. `/today`: overdue first, then due today, then upcoming seven days. Each row
   states which mode and which subject it belongs to and links straight there.
8. Optional Telegram morning digest of overdue and due-today tasks, reusing the
   existing notification module and settings pattern. Off by default.

### Acceptance Criteria

- Editing a note cannot alter stage timing or any historical entry.
- Every stage and status change is reconstructible from the timeline alone.
- `/today` combines freelance and job-hunt items in one ordered list.
- With notifications disabled, no scheduled work sends anything.

### Tests

- Append-only enforcement; delete-window boundary; scope query correctness across
  timezone boundaries (store UTC, render Europe/Berlin); digest composition and
  the disabled path.

### Commit

`feat: add shared activity timeline and follow-ups`

---

## Phase 4: Lead Capture And Site Audit

### Scope

1. Migration `011_site_audits.sql`.
2. `/api/audit` accepts a URL and stores a technical snapshot: HTTP status, final
   URL, HTTPS, response time, declared charset and mojibake detection, viewport
   meta presence, page weight, generator/CMS fingerprint, presence of
   Impressum/Datenschutz links, Open Graph tags, and last-modified headers.
   Ten-second timeout, one retry, failures stored as a failed audit rather than
   discarded.
   Local, link-local, and private-network targets are rejected before fetch and
   every redirect target is validated again.
3. Paste-a-URL lead creation: given a URL, create the organization with
   pre-filled name and website, run one audit, and open the detail view.
4. Audit findings render as a plain checklist on the organization page — the
   pitch evidence, in the shop, on a phone.
5. Re-run audit action with a stored history so improvement is visible.

### Acceptance Criteria

- A prospect goes from URL to saved record with findings in one action.
- A dead or slow site produces a stored failed audit with a readable reason,
  never a hang.
- No audit stores full page HTML.

### Tests

- Fixture pages covering broken encoding, missing viewport, no HTTPS, missing
  Impressum, and timeout.

### Commit

`feat: add prospect site audits`

---

## Phase 5: Outreach Templates

### Scope

1. Migration `012_message_templates.sql`: title, channel, language, body,
   variables.
2. Templates with `{{contact_first_name}}`, `{{organization_name}}`,
   `{{district}}`, `{{finding}}` placeholders and per-language variants
   (de / it / en).
3. Compose action on a contact: pick a template, auto-fill from the record,
   review, copy. Copy-to-clipboard only — KOBOLD never sends on your behalf.
4. Logging a sent message writes an activity and optionally creates a follow-up
   task in one step.

### Acceptance Criteria

- Composing from a contact whose language is Italian defaults to the Italian
  variant.
- A missing variable renders visibly as a gap, never as an empty string that
  ships silently.
- Copying and logging is a single interaction.

### Tests

- Variable substitution including missing values; language fallback order
  (contact → organization → `de`).

### Commit

`feat: add outreach templates`

---

## Phase 6: Metrics And Consolidation

### Scope

1. Migration `013_application_links.sql`: nullable `organization_id` on
   `applications`, so an employer can also be an organization without touching
   snapshot behavior. The same additive migration establishes an opportunity
   value-history baseline and records later value changes as immutable events.
2. Freelance metrics: new leads per week, contact-to-conversation rate,
   proposal win rate, average days per stage, pipeline value over time, loss
   reasons breakdown.
3. If job-hunt pipeline metrics already exist, reuse their components and visual
   language rather than building a second charting approach.
4. CSV export for organizations, contacts, opportunities, and activities.

### Acceptance Criteria

- Every metric is derivable from stored events, not recomputed from mutable
  fields.
- Export round-trips through a spreadsheet without breaking on commas, quotes,
  or umlauts.

### Commit

`feat: add pipeline metrics and export`

---

## Phase 7: Hardening And Release

### Scope

1. Extend the authorization matrix test to every new route.
2. Add the new tables to backup/export procedures and to
   `PRODUCTION_READINESS.md`.
3. Accessibility pass on pipeline, timeline, and Today, matching the standards
   in the improvement plan's phase 5.
4. Document the CRM workflows in `README.md` and the migration order in
   `OPERATIONS.md`.

### Commit

`chore: harden CRM release`

---

## Deploying Onto A Live App

- Apply each migration in Supabase before deploying the code that reads it.
- Never rename or drop an existing column, table, or route in this plan.
- Ship each phase to production as soon as its gate passes; do not accumulate a
  long-lived branch against a moving app.
- Before every deploy, run the existing verification set unchanged:
  `npm test`, `npm run typecheck`, `npm run typecheck:extension`, `npm run build`,
  `npm run build:extension`.
- Treat a job-side regression as a rollback trigger, not a bug to fix forward.
  The live workflow matters more than the new mode.
- Update `PRODUCTION_READINESS.md` in the same commit that adds a migration, so
  the required-migration list never lags the deployed API.

## Release Gates

- Both modes are reachable, and no job-side behavior regressed.
- Every new API route rejects unauthenticated requests.
- Activities cannot be rewritten after the delete window.
- A stage change is always reconstructible from the timeline.
- `/today` shows freelance and job items together, ordered by urgency.
- No new table is readable with the anon key.
- Site audits store no page HTML.
- Fixture mode renders every new screen without network access.
- Telegram sends nothing while task notifications are disabled.

## Non-Goals

No invoicing, time tracking, contracts, or e-signature. No email sending or
inbox sync. No multi-user or client-facing portal. No marketplace scraping. No
automated outreach of any kind — every message is copied and sent by hand.

## Sequencing Note

Phases 0 through 3 are the product. Phase 3 is where the tool starts saving time,
because until follow-ups exist a CRM is just a list. Phases 4 and 5 automate the
research and outreach work currently done by hand. Phase 6 only pays off once
enough history exists to measure, so do not build it early.
