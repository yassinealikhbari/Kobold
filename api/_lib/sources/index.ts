import { arbeitnowAdapter } from './arbeitnow.js';
import { berlinStartupJobsAdapter } from './berlinstartupjobs.js';
import { germanTechJobsAdapter } from './germantechjobs.js';
import { remoteOkAdapter } from './remoteok.js';
import type { SourceAdapter } from './types.js';
import { vuejobsAdapter } from './vuejobs.js';
import { workingNomadsAdapter } from './workingnomads.js';

export const sourceAdapters = [
  arbeitnowAdapter,
  vuejobsAdapter,
  berlinStartupJobsAdapter,
  germanTechJobsAdapter,
  workingNomadsAdapter,
  remoteOkAdapter,
] satisfies SourceAdapter[];

export function getSourceAdapter(name: string): SourceAdapter | undefined {
  return sourceAdapters.find((adapter) => adapter.name === name);
}
