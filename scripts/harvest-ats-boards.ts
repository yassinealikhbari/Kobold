// Finds new Greenhouse/Lever/Ashby board tokens and prints registry entries to review.
//
// Tokens come from two places:
//   1. Harvest: ATS apply URLs mentioned in listings from the non-ATS sources.
//      Raw feeds are scanned before profile filtering, so a board is found even
//      when the cross-posted listing itself is out of scope.
//   2. Seeds: company names passed as CLI args, probed as slugified token guesses.
//
// Every candidate is validated against the public board API before being printed.
//
//   npm run harvest:ats
//   npm run harvest:ats -- "Babbel" "Trade Republic" "Hello Fresh"

import { ASHBY_BOARDS, GREENHOUSE_BOARDS, LEVER_BOARDS } from '../api/_lib/sources/ats-registry';
import { fetchJson } from '../api/_lib/sources/http';
import { sourceAdapters } from '../api/_lib/sources';
import type { RawJob } from '../api/_lib/sources/types';

type AtsName = 'greenhouse' | 'lever' | 'ashby';

type Candidate = {
  ats: AtsName;
  token: string;
  company: string;
  seenVia: string;
};

type ProbeOutcome = Candidate & { jobCount: number };

const PROBE_CONCURRENCY = 5;

const TOKEN_PATTERNS: Record<AtsName, RegExp> = {
  greenhouse: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_(?:board|app)\?for=)?([A-Za-z0-9_-]+)/gi,
  lever: /jobs\.(?:eu\.)?lever\.co\/([A-Za-z0-9_-]+)/gi,
  ashby: /jobs\.ashbyhq\.com\/([A-Za-z0-9._-]+)/gi,
};

const TOKEN_BLOCKLIST = new Set(['embed', 'v1', 'jobs', 'careers', 'api']);

const REGISTERED: Record<AtsName, Set<string>> = {
  greenhouse: new Set(GREENHOUSE_BOARDS.map((board) => board.token.toLowerCase())),
  lever: new Set(LEVER_BOARDS.map((board) => board.token.toLowerCase())),
  ashby: new Set(ASHBY_BOARDS.map((board) => board.token.toLowerCase())),
};

async function main() {
  const seedNames = process.argv.slice(2).map((name) => name.trim()).filter(Boolean);
  const candidates = new Map<string, Candidate>();

  console.log('Scanning non-ATS sources for ATS apply URLs...');
  for (const adapter of sourceAdapters) {
    if (adapter.name in REGISTERED) continue;
    try {
      const result = await adapter.fetchJobs();
      let found = 0;
      for (const job of result.jobs) {
        found += collectFromJob(job, adapter.name, candidates);
      }
      console.log(`  ${adapter.name}: ${result.jobs.length} listings scanned, ${found} board references`);
    } catch (error) {
      console.warn(`  ${adapter.name}: failed to fetch (${errorText(error)})`);
    }
  }

  for (const name of seedNames) {
    for (const token of guessTokens(name)) {
      for (const ats of Object.keys(TOKEN_PATTERNS) as AtsName[]) {
        addCandidate(candidates, { ats, token, company: name, seenVia: 'seed' });
      }
    }
  }

  const fresh = [...candidates.values()].filter((candidate) => !REGISTERED[candidate.ats].has(candidate.token));
  const known = candidates.size - fresh.length;
  console.log(`\n${candidates.size} distinct board candidates (${known} already registered, ${fresh.length} to probe)`);
  if (fresh.length === 0) return;

  const valid: ProbeOutcome[] = [];
  const invalid: Candidate[] = [];
  for (let i = 0; i < fresh.length; i += PROBE_CONCURRENCY) {
    const batch = fresh.slice(i, i + PROBE_CONCURRENCY);
    const outcomes = await Promise.all(batch.map(probeCandidate));
    outcomes.forEach((jobCount, index) => {
      const candidate = batch[index]!;
      if (jobCount === null) invalid.push(candidate);
      else valid.push({ ...candidate, jobCount });
    });
  }

  for (const ats of ['greenhouse', 'lever', 'ashby'] as const) {
    const boards = valid
      .filter((entry) => entry.ats === ats)
      .sort((left, right) => right.jobCount - left.jobCount);
    if (boards.length === 0) continue;
    console.log(`\n// ${ats.toUpperCase()}_BOARDS additions:`);
    for (const board of boards) {
      console.log(`  { company: '${board.company.replace(/'/g, "\\'")}', token: '${board.token}' }, // ${board.jobCount} open jobs, via ${board.seenVia}`);
    }
  }

  const seedMisses = invalid.filter((candidate) => candidate.seenVia === 'seed');
  const harvestMisses = invalid.length - seedMisses.length;
  console.log(`\n${valid.length} valid boards, ${invalid.length} probes failed (${harvestMisses} stale harvest links).`);
  const missedNames = new Set(seedNames.filter((name) => !valid.some((entry) => entry.seenVia === 'seed' && entry.company === name)));
  if (missedNames.size > 0) {
    console.log(`Seeds with no board found on any ATS: ${[...missedNames].join(', ')}`);
  }
}

function collectFromJob(job: RawJob, source: string, candidates: Map<string, Candidate>): number {
  const haystack = [job.url, job.applyUrl, job.descriptionHtml, job.descriptionText].filter(Boolean).join('\n');
  let found = 0;
  for (const [ats, pattern] of Object.entries(TOKEN_PATTERNS) as Array<[AtsName, RegExp]>) {
    for (const match of haystack.matchAll(pattern)) {
      const token = match[1]!.toLowerCase();
      if (TOKEN_BLOCKLIST.has(token)) continue;
      found += addCandidate(candidates, { ats, token, company: job.company.trim() || token, seenVia: source }) ? 1 : 0;
    }
  }
  return found;
}

function addCandidate(candidates: Map<string, Candidate>, candidate: Candidate): boolean {
  const key = `${candidate.ats}:${candidate.token}`;
  if (candidates.has(key)) return false;
  candidates.set(key, candidate);
  return true;
}

function guessTokens(company: string): string[] {
  const base = company
    .toLowerCase()
    .replace(/\b(gmbh|se|ag|inc|ltd|co\.?\s?kg)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!base) return [];
  return Array.from(new Set([base.replace(/ /g, ''), base.replace(/ /g, '-')]));
}

async function probeCandidate(candidate: Candidate): Promise<number | null> {
  try {
    if (candidate.ats === 'greenhouse') {
      const response = await fetchJson<{ jobs?: unknown[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(candidate.token)}/jobs`,
      );
      return response.jobs?.length ?? 0;
    }
    if (candidate.ats === 'lever') {
      const response = await fetchJson<unknown[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(candidate.token)}?mode=json`,
      );
      return Array.isArray(response) ? response.length : 0;
    }
    const response = await fetchJson<{ jobs?: unknown[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(candidate.token)}`,
    );
    return response.jobs?.length ?? 0;
  } catch {
    return null;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
