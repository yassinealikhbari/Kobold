import { createJobDiscovery } from '../api/_lib/job-discovery';
import { sourceAdapters } from '../api/_lib/sources';

const discovery = createJobDiscovery({
  adapters: sourceAdapters,
  cacheTtlMs: 0,
  sourceTimeoutMs: 20_000,
});
const result = await discovery.discoverJobs({ forceRefresh: true });

for (const source of result.coverage) {
  console.log(
    [
      `${source.source}: ${source.status}`,
      `fetched ${source.fetched}`,
      `parsed ${source.parsed}`,
      `eligible ${source.eligible}`,
      `returned ${source.returned}`,
      `duplicates ${source.duplicates}`,
      `${source.duration_ms} ms`,
    ].join(' | '),
  );

  const excluded = Object.entries(source.excluded)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `${reason}=${count}`)
    .join(', ');
  if (excluded) console.log(`  excluded: ${excluded}`);
  for (const warning of source.warnings) console.warn(`  warning: ${warning}`);
  if (source.error) console.error(`  error: ${source.error}`);
}

const vueJobs = result.jobs.filter((job) => job.sources.includes('vuejobs'));
const missingVueJobsCompany = vueJobs.filter((job) => !job.company || job.company === '(see listing)').length;
const missingVueJobsLocation = vueJobs.filter((job) => !job.location).length;
console.log(`total: ${result.jobs.length} eligible unique jobs`);
console.log(
  `vuejobs metadata: ${missingVueJobsCompany} missing company, ${missingVueJobsLocation} missing location among ${vueJobs.length} returned`,
);

if (result.coverage.some((source) => source.status === 'failed')) process.exitCode = 1;
