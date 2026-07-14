# KOBOLD Gold Mine Rebuild Plan

## Outcome

KOBOLD must be a complete, trustworthy job-discovery inbox that saves time
between finding a role and submitting an application. It must show every
eligible role, rank newest listings first, explain uncertainty instead of
silently hiding opportunities, and persist a full listing only after the user
confirms an application.

## Locked Search Profile

- Role families: Frontend Developer, Frontend Engineer, UI Engineer, Product
  Engineer, Full-stack Engineer, and Software Engineer.
- Seniority: mid-level and senior. Unknown seniority remains visible with a
  verification flag; junior, staff, lead, manager, student, and internship
  roles are excluded.
- Experience baseline: 5-6 years.
- Technologies: Vue, Nuxt, and React are detected and filterable. Technology is
  not a discovery gate. VueJobs listings are trusted as Vue-relevant.
- Locations: Berlin onsite/hybrid, all Germany, Europe remote, and worldwide
  remote. Region-locked remote jobs outside Europe are excluded.
- Work authorization: EU citizen; sponsorship is not required.
- Language: English-only. German-language or German-required roles are
  excluded; ambiguous language requirements remain visible with a warning.
- Employment: full-time, contract, and freelance. Part-time roles are excluded.
- Compensation: no minimum.
- Freshness: listings older than 14 days are hidden by default.
- VueJobs exception: every fresh English listing is visible. Listings outside
  the target role, seniority, employment, or location profile are labeled and
  filterable but do not enter Telegram alerts.
- Ordering: newest first. Match quality is a label and optional secondary sort,
  never a visibility gate.
- Industry/company exclusions: none.

## Persistence Rules

- Full live job listings are never stored in Supabase before application.
- Seen, saved, and dismissed IDs are stored in browser storage.
- A full immutable job snapshot is stored in `applications` only after the user
  confirms submission.
- Supabase may store only a source fingerprint, source name, and discovery /
  notification timestamps before application. Fingerprints exist solely to
  prevent duplicate notifications and contain no listing content.
- Source responses may use short-lived server or HTTP caches for reliability
  and speed; caches are not the system of record.

## Product Workflow

### Discovery Inbox

- `New`: eligible listings not yet reviewed in this browser.
- `All`: every visible listing from the current 14-day window, including
  source-trusted VueJobs entries outside the target profile.
- `Saved`: browser-local shortlist.
- `Applied`: opens the persisted application tracker.
- Default sort is newest first.
- Filters include technology, source, location/work mode, employment type, and
  match label.
- The Board displays per-source counts, fetch time, warnings, and failures.
- Empty states explain whether no jobs were fetched, no jobs were eligible, or
  the active filters removed them.

### Review And Apply

- Job cards show title, company, precise location, source, publication time,
  technologies, employment type, match label, and concise match/risk reasons.
- Save and dismiss update immediately and support undo.
- Job detail reuses the current discovery snapshot and falls back to a targeted
  source refresh, not a full multi-source scan.
- Cover-letter drafts remain local until application confirmation.
- Confirming `I applied` stores the application and listing snapshot.

### Application Assistant

- A Chrome-compatible extension fills common text/select fields on Greenhouse,
  Lever, Ashby, and generic ATS forms.
- It never submits an application.
- File inputs remain user-controlled; the extension highlights the CV upload
  field because browsers do not permit silently attaching a local file.
- Filled fields are visibly marked so the user can review every value.

## Discovery Architecture

Create one deep `job-discovery` module with this external interface:

```ts
discoverJobs({ sources?, forceRefresh? }): Promise<DiscoveryResult>
findDiscoveredJob({ id, source? }): Promise<DiscoveredJob | null>
```

The implementation owns:

- parallel source execution and timeouts;
- short-lived source snapshot caching;
- source diagnostics and filter waterfall counts;
- raw-field normalization and technology detection;
- eligibility classification against the locked search profile;
- deterministic source-aware identity and cross-source deduplication;
- profile-aware fit labels and reasons;
- freshness and newest-first ordering.

Callers receive jobs and diagnostics. They do not reproduce source, filter,
deduplication, or ranking rules.

## Source Strategy

### Repair

- VueJobs: parse employer and location from RSS descriptions, preserve direct
  URLs, trust source technology classification, and deduplicate by listing URL
  before fallback title/company identity.
- Arbeitnow: remove Vue pre-filter and classify all returned engineering roles.
- Working Nomads and Remote OK: remove Vue pre-filters and classify all returned
  roles.
- BerlinStartupJobs: query role-family feeds rather than the empty Vue-only feed.
- Remove sources that now redirect or consistently expose no usable feed.

### Add

- Remotive public API.
- We Work Remotely frontend/full-stack RSS feeds.
- Himalayas public search API when it passes timeout/reliability checks.
- Public company ATS boards through Greenhouse, Lever, and Ashby adapters with a
  verified Berlin/Europe company registry.

LinkedIn and Indeed are not scraped. KOBOLD targets the same jobs at the cleaner
company-career or ATS source.

## Eligibility Model

Eligibility and fit are separate:

1. Normalize the source record without discarding it.
2. Evaluate hard eligibility: role family, age, language, employment type,
   seniority, and location/work authorization.
3. Preserve a reason for every exclusion and warning.
4. Detect technologies independently.
5. Calculate fit against profile/CV, but never hide an eligible job by score.

Every source diagnostic reports:

- fetched;
- parsed;
- eligible;
- excluded by each reason;
- duplicates merged;
- returned;
- duration and warnings/errors.

## Telegram Scan

- GitHub Actions calls one all-source scan every three hours, with one daily
  Vercel Hobby-compatible fallback.
- The scan compares deterministic IDs with `job_fingerprints`.
- Only genuinely new target-profile jobs enter one combined Telegram digest.
- The digest links directly to source listings.
- Failed notification attempts remain retryable; successful fingerprints are
  marked with `notified_at`.
- A failed source does not prevent other sources from completing or notifying.

## Delivery Phases

### Phase 1: Plan And Search Profile

- Record all locked decisions and acceptance gates.
- Commit: `docs: define gold mine rebuild plan`.

### Phase 2: Discovery Correctness

- Implement the deep discovery module and filter waterfall.
- Fix VueJobs metadata parsing and deterministic identity.
- Separate eligibility, technology detection, and match ranking.
- Add interface-level tests with in-memory source adapters.
- Commit: `refactor: rebuild job discovery pipeline`.

### Phase 3: Source Coverage

- Broaden existing adapters and add verified public feeds.
- Add public ATS adapters and a verified company registry.
- Add source contract tests and live audit reporting.
- Commit: `feat: expand live job source coverage`.

### Phase 4: Discovery Inbox UX

- Build New / All / Saved views and local review state.
- Add technology and eligibility filters, newest-first ordering, diagnostics,
  useful card hierarchy, undo, and accurate empty/loading states.
- Commit: `feat: turn board into a discovery inbox`.

### Phase 5: Telegram Freshness

- Add fingerprint migration and all-source scheduled scan.
- Restore one combined Telegram digest every three hours when new jobs exist.
- Commit: `feat: notify on newly discovered jobs`.

### Phase 6: Personalized Fit

- Derive fit labels and reasons from profile/CV plus the 5-6 year baseline.
- Keep every eligible job visible and newest-first by default.
- Commit: `feat: personalize job fit explanations`.

### Phase 7: Fill-Only Extension

- Add extension manifest, secure profile sync, ATS-specific fillers, generic
  fallback, review markings, and extension tests.
- Commit: `feat: add application autofill extension`.

### Phase 8: Release Verification

- Run unit, source-contract, type, build, migration, API, desktop/mobile visual,
  and production smoke checks.
- Update deployment, scheduler, extension-install, and recovery documentation.
- Commit: `chore: verify gold mine release`.

## Release Gates

- VueJobs results retain company and location whenever present in the feed.
- Every fresh English VueJobs listing is reachable and its target-profile state
  is explicit.
- No active source failure is silent in the Board.
- Every eligible listing from the discovery result is reachable in All.
- Default ordering is publication date descending.
- Filters never trigger a fresh third-party network scan.
- No full pre-application listing exists in Supabase.
- A repeated scan sends no duplicate Telegram notification.
- One source failure does not blank the Board or suppress other notifications.
- Profile fit changes labels/reasons, not eligibility.
- The extension never submits a form.
