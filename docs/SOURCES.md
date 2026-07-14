# Job Sources

KOBOLD reads public job feeds at request time. Listings are normalized and
filtered in memory; full listing content is not persisted before an application
is confirmed.

## Active Sources

| Source | Interface | Scope |
| --- | --- | --- |
| Arbeitnow | Public JSON API | Recent Germany and remote jobs |
| VueJobs | Public RSS | Vue ecosystem jobs |
| Berlin Startup Jobs | Public engineering RSS | Berlin startup engineering jobs |
| Working Nomads | Public JSON feed | Remote jobs |
| Remote OK | Public JSON feed | Remote jobs |
| Remotive | Public software-development API | Remote software jobs |
| We Work Remotely | Public frontend and full-stack RSS | Remote frontend/full-stack jobs |
| Himalayas | Public latest-jobs RSS | Remote jobs |
| Greenhouse | Public Job Board API | Verified Berlin/Germany company boards |
| Lever | Public Postings API | Verified Berlin company boards |
| Ashby | Public Job Postings API | Verified Berlin/Germany company boards |

LinkedIn and Indeed are not scraped. Direct company and ATS listings are used
when the same opportunity is publicly available there.

## ATS Registry

The reviewed company-board tokens live in
`api/_lib/sources/ats-registry.ts`. A missing or retired board produces a source
warning without failing the other boards or sources.

When adding a board:

1. Confirm its public careers URL and ATS token.
2. Add the company and token to the matching registry.
3. Run `npm test` for adapter contracts.
4. Run `npm run test:sources` against live endpoints.
5. Remove or correct any board that reports a warning.

## Attribution

Remotive, We Work Remotely, and Himalayas require listings to link back to the
source. Their adapters therefore keep the public source URL as the listing URL,
and the Board must continue to display the source name. ATS adapters preserve
the hosted job and application URLs supplied by the company board.

## Live Audit

`npm run test:sources` prints, for every source:

- fetched and parsed rows;
- eligible and returned jobs;
- duplicates merged;
- exclusions grouped by reason;
- duration, warnings, and errors.

The command exits unsuccessfully when an active source fails. An empty source is
reported separately and does not hide results from healthy sources.
