import { sourceAdapters } from '../api/_lib/sources';

let failures = 0;

for (const adapter of sourceAdapters) {
  const startedAt = Date.now();

  try {
    const result = await adapter.fetchJobs();
    const elapsed = Date.now() - startedAt;
    console.log(`${adapter.name}: ${result.jobs.length} jobs (${elapsed} ms)`);
    for (const warning of result.warnings ?? []) console.warn(`  warning: ${warning}`);
  } catch (error) {
    failures += 1;
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${adapter.name}: ERROR after ${elapsed} ms`);
    console.error(`  ${message}`);
  }
}

if (failures > 0) {
  console.error(`${failures} source(s) failed`);
  process.exitCode = 1;
}
