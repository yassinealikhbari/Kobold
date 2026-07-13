import { arbeitnowAdapter } from './arbeitnow';
import { berlinStartupJobsAdapter } from './berlinstartupjobs';
import { germanTechJobsAdapter } from './germantechjobs';
import { remoteOkAdapter } from './remoteok';
import { stepStoneAdapter } from './stepstone';
import type { SourceAdapter } from './types';
import { vuejobsAdapter } from './vuejobs';
import { workingNomadsAdapter } from './workingnomads';

export const sourceAdapters = [
  arbeitnowAdapter,
  vuejobsAdapter,
  stepStoneAdapter,
  berlinStartupJobsAdapter,
  germanTechJobsAdapter,
  workingNomadsAdapter,
  remoteOkAdapter,
] satisfies SourceAdapter[];

export function getSourceAdapter(name: string): SourceAdapter | undefined {
  return sourceAdapters.find((adapter) => adapter.name === name);
}
