import { arbeitnowAdapter } from './arbeitnow.js';
import { ashbyAdapter } from './ashby.js';
import { berlinStartupJobsAdapter } from './berlinstartupjobs.js';
import { greenhouseAdapter } from './greenhouse.js';
import { himalayasAdapter } from './himalayas.js';
import { leverAdapter } from './lever.js';
import { remotiveAdapter } from './remotive.js';
import { remoteOkAdapter } from './remoteok.js';
import type { SourceAdapter } from './types.js';
import { vuejobsAdapter } from './vuejobs.js';
import { weWorkRemotelyAdapter } from './weworkremotely.js';
import { workingNomadsAdapter } from './workingnomads.js';

export const sourceAdapters = [
  arbeitnowAdapter,
  vuejobsAdapter,
  berlinStartupJobsAdapter,
  workingNomadsAdapter,
  remoteOkAdapter,
  remotiveAdapter,
  weWorkRemotelyAdapter,
  himalayasAdapter,
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
] satisfies SourceAdapter[];

export function getSourceAdapter(name: string): SourceAdapter | undefined {
  return sourceAdapters.find((adapter) => adapter.name === name);
}
