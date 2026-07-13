# Improvement Plan

## Goal

Make KOBOLD a dependable daily application workspace for finding,
evaluating, applying to, and following up on Vue.js roles. The tool should
reduce time spent triaging listings, never misrepresent source health, and
surface the next useful action for every application.

## Operating Rules

- Preserve the personal, single-owner deployment model unless multi-user access
  is explicitly added as a separate product decision.
- Keep all browser access behind `/api`; do not expose Supabase credentials to
  the client.
- Make each phase independently deployable and commit it after its verification
  gate passes.
- Do not treat a zero-result source run as success unless the source genuinely
  returned an empty response.
- Prefer explicit job/application state over inferred UI state.

## Phase 0: Establish A Reliable Baseline

**Status:** Complete in `chore: add reliability baseline and CI`.

### Scope

1. Create a production-readiness checklist for environment variables, Supabase
   migrations, storage bucket, cron registration, Telegram configuration, and
   OpenAI configuration.
2. Add a minimal error-reporting seam that records server exceptions with route,
   source, and request context while keeping secrets out of logs.
3. Add a seed/fixture path for local UI development without live Supabase or
   source dependencies.
4. Add CI for `npm test`, `npm run typecheck`, and `npm run build`.

### Acceptance Criteria

- A new contributor can run the app with deterministic fixture data.
- A failed server route leaves an actionable log entry.
- Pull requests cannot merge when tests, typecheck, or production build fail.

### Commit

`chore: add reliability baseline and CI`

## Phase 1: Repair Scheduled Ingest And Source Health

**Status:** Complete in `fix: make ingest scheduling and source health reliable`.

### Scope

1. Make `/api/ingest` accept Vercel Cron's `GET` request for the lifecycle pass
   and validate `Authorization: Bearer <CRON_SECRET>`.
2. Keep authenticated manual refreshes as `POST`, with the existing session
   authorization.
3. Ensure every created `ingest_runs` row is finalized, including unexpected
   database, source, notification, and serialization failures.
4. Classify source results as `success`, `empty`, `partial`, or `failed`.
   Persist a useful error when a source parser fails or returns an implausible
   empty result after a previous healthy run.
5. Stop swallowing per-page GermanTechJobs errors. Return a partial failure with
   the failed URL and still retain successfully parsed pages.
6. Track source health: latest successful run, latest non-zero run, duration,
   error count, and active-job count.
7. Make Telegram optional. Disable notifications by default until both Telegram
   credentials are configured, and do not mark a successful ingest as failed
   merely because notifications are not configured.
8. Add a recovery action in Settings for rerunning one failed source.

### Data Changes

- Add source-health fields or a dedicated `source_health` table.
- Add indexes for `ingest_runs(source, started_at desc)` and job lifecycle
  queries on `(status, last_seen_at desc)`.

### Acceptance Criteria

- The Vercel lifecycle cron completes successfully in production.
- A parser error is visible in both the run history and board sync status.
- A source returning zero results is distinguishable from a parser/network
  failure.
- A missing Telegram configuration cannot make a normal ingest appear failed.

### Tests

- Authorization tests for manual refresh, external cron, and invalid requests.
- Ingest finalization tests for adapter failure, database failure, and
  notification failure.
- Adapter tests for partial GermanTechJobs failure and zero-result behavior.

### Commit

`fix: make ingest scheduling and source health reliable`

## Phase 2: Make The Board Trustworthy And Fast To Triage

**Status:** Complete in `feat: improve board triage and ranking transparency`.

### Scope

1. Replace the current implicit 50-job cap with cursor pagination or an explicit
   `Load more` flow. Preserve sort order across pages.
2. Cancel stale board requests or use request sequence IDs so an older search
   response cannot replace newer filters.
3. Correct ingest statistics to report separately:
   - raw found
   - matching active jobs
   - newly stored active jobs
   - stored dismissed jobs
   - updated existing jobs
4. Store score reasons during normalization, for example `Vue in title`,
   `Remote EU`, `TypeScript`, and `7+ years requested`.
5. Display score reasons and a confidence label on each job card/detail page.
6. Replace the raw numeric minimum-score field with understandable controls:
   `Best matches`, `Good matches`, and `Show all`.
7. Add persistent active filter chips, a visible clear-all control, and saved
   filter presets such as `Remote EU`, `Berlin`, and `New today`.
8. Add list density modes: compact triage and detailed review.
9. Add bulk actions for save, dismiss, and restore, with undo feedback.
10. Distinguish `new`, `updated`, `stale`, and `applied` jobs visually.

### Data Changes

- Add `score_reasons text[]` and optionally `source_posted_at` if preserving the
  original posting date per source becomes necessary.
- Add an index that supports the final board query and cursor ordering.

### Acceptance Criteria

- Every reported matching job is reachable from the board.
- Filtering remains correct while typing quickly.
- A user can explain why a job ranks above another without reading source code.
- An empty result state identifies whether filters or ingest data are responsible.

### Tests

- API pagination, cursor, search escaping, and invalid-query tests.
- Store tests for stale-request cancellation.
- UI tests for score explanations, clear filters, and load more.

### Commit

`feat: improve board triage and ranking transparency`

## Phase 3: Build A Deliberate Application Workflow

### Scope

1. Add a profile-completeness indicator to the navigation and job detail page.
   Show exactly which required application assets are missing.
2. Keep `Save` as an explicit intent; never create tracker records by viewing a
   job.
3. Add a clear external-application sequence:
   - prepare CV and letter
   - open external application form
   - confirm whether the application was submitted
4. Add manual job creation and a paste-listing flow for roles found outside the
   integrated sources.
5. Add configurable cover-letter templates and a reusable base letter.
6. Enforce generation controls: instruction length limits, request timeout,
   per-day generation budget, and useful provider errors.
7. Validate profile data server-side: URLs, duplicate skills, language/work
   history shape, and maximum field lengths.
8. Validate uploaded PDFs by file signature as well as MIME type.
9. Display file name, upload time, and replace/download actions for the CV.
10. Add visible autosave states and retry controls for letters and notes.

### Acceptance Criteria

- A user can complete a real application from a job detail page with no hidden
  state transitions.
- Profile gaps are clear before an application is started.
- A failed letter generation never loses manually edited letter text.
- A malformed profile or non-PDF upload is rejected with a useful message.

### Tests

- Application creation/marking transition tests.
- Cover-letter input validation, timeout, and provider-error tests.
- CV signature validation tests.
- End-to-end flow: profile -> save -> generate -> open -> mark applied.

### Commit

`feat: streamline application preparation and submission`

## Phase 4: Turn The Tracker Into A Follow-Up System

### Scope

1. Add application fields for next action, follow-up date, contact name, contact
   channel, salary target, referral, interview date, and outcome/rejection
   reason.
2. Add an immutable activity timeline for save, apply, status changes, notes,
   interview scheduling, and follow-up completion.
3. Add a dedicated `Today`/`Follow-ups` view sorted by overdue and upcoming work.
4. Add reminders through Telegram for due and overdue follow-ups.
5. Keep drag-and-drop, but add a keyboard/touch-accessible status selector.
6. Add confirmation and undo for deleting an application.
7. Add tracker filters, search, sort, archive, and CSV export.
8. Show pipeline metrics: applications this week, interviews, response rate,
   average days per stage, and overdue follow-ups.

### Data Changes

- Extend `applications` with scheduling/contact fields.
- Add `application_events` for the timeline.
- Add indexes for `next_action_at`, `status_changed_at`, and activity ordering.

### Acceptance Criteria

- Opening the tool immediately shows the next applications needing attention.
- Editing a note cannot alter stage timing or follow-up dates.
- Every status transition is recoverable from the activity timeline.

### Tests

- Status transition, follow-up, reminder, and event-history tests.
- Keyboard interaction test for changing tracker status.
- End-to-end overdue follow-up scenario.

### Commit

`feat: add follow-up management and tracker history`

## Phase 5: Accessibility, Interaction Quality, And Responsive UI

### Scope

1. Add visible `:focus-visible` states, semantic labels, accessible status text,
   and screen-reader feedback for save/dismiss/restore actions.
2. Replace mouse-only interactions with keyboard and touch alternatives.
3. Audit contrast, form errors, disabled states, loading states, and reduced
   motion behavior.
4. Make the desktop board denser without compromising scanability; use available
   width for job evidence and next actions.
5. Rework mobile navigation and tracker layout for 320px through desktop widths.
6. Add a logout action and confirm destructive actions.
7. Add empty/loading/error state variants for every primary screen.

### Acceptance Criteria

- Core workflows work with keyboard only.
- No control relies only on color or hover to communicate state.
- Board, job detail, tracker, profile, and settings fit without clipping at
  mobile and desktop viewports.

### Tests

- Automated accessibility checks for primary routes.
- Visual regression screenshots for desktop and mobile breakpoints.
- Keyboard-only end-to-end workflow.

### Commit

`feat: improve accessibility and responsive workflows`

## Phase 6: Security, Quality, And Operational Hardening

### Scope

1. Move login rate limiting from in-memory state to a durable provider suitable
   for serverless execution.
2. Add security headers and a content security policy compatible with the SPA.
3. Add server-side request validation for every mutable API route.
4. Add idempotency protection for application changes and notification delivery.
5. Add structured logging, source-health alerts, and error monitoring.
6. Add backup/export procedures for profile, applications, and notes.
7. Document deployment rollback, migration rollback, cron verification, and
   incident response.
8. Review dependency updates and automate vulnerability checks.

### Acceptance Criteria

- Login protection works consistently across concurrent serverless instances.
- Failed source runs and failed notifications are observable without opening the
  application.
- Production deployment, migration, cron, and rollback checks are documented
  and repeatable.

### Tests

- Authorization matrix for all API routes.
- Security-header and validation tests.
- Migration smoke test against an empty database.
- Production-like deploy smoke test.

### Commit

`chore: harden security and operations`

## Release Gate

Do not describe the tool as production-ready until all of the following are
true:

- Every migration has been applied to the production Supabase project.
- Vercel Cron lifecycle execution has been observed as successful.
- At least one successful ingest and one intentional source failure have been
  verified in Settings.
- The board can display more than 50 jobs correctly.
- A full application and follow-up workflow has passed end-to-end testing.
- Accessibility and responsive checks pass for the primary routes.
- Monitoring and recovery instructions are available to the owner.

## Execution Order

Implement phases 0 through 2 first. They repair data trust and job triage, which
are prerequisites for every later workflow. Phase 3 then improves the direct
application experience; phase 4 provides the long-term time savings through
follow-up discipline. Phases 5 and 6 harden the resulting workflow before a
broader release.
