import { getSupabase } from './db.js';
import type { DiscoveredJob } from './job-discovery.js';
import { sendCombinedJobDigest, type TelegramDigestResult, type TelegramJob } from './telegram.js';

const DATABASE_BATCH_SIZE = 200;

export type FingerprintRecord = {
  fingerprint: string;
  notified_at: string | null;
};

export type FingerprintWrite = {
  fingerprint: string;
  sources: string[];
  last_discovered_at: string;
  notified_at?: string;
};

export type FingerprintRepository = {
  hasAny(): Promise<boolean>;
  find(fingerprints: string[]): Promise<FingerprintRecord[]>;
  upsert(records: FingerprintWrite[]): Promise<void>;
  markAttempted(fingerprints: string[], attemptedAt: string): Promise<void>;
  markNotified(fingerprints: string[], notifiedAt: string): Promise<void>;
  markFailed(fingerprints: string[], attemptedAt: string, error: string): Promise<void>;
};

export type JobNotificationResult = {
  baselined: number;
  newFingerprints: number;
  candidates: number;
  sent: number;
  pending: number;
  disabled: boolean;
  error: string | null;
};

type JobNotificationDependencies = {
  repository: FingerprintRepository;
  notificationsEnabled(): Promise<boolean>;
  sendDigest(jobs: TelegramJob[]): Promise<TelegramDigestResult>;
  now(): Date;
};

export function createJobNotificationService(dependencies: JobNotificationDependencies) {
  return async function process(jobs: DiscoveredJob[]): Promise<JobNotificationResult> {
    const uniqueJobs = Array.from(new Map(jobs.map((job) => [job.id, job])).values());
    const fingerprints = uniqueJobs.map((job) => job.id);
    const now = dependencies.now().toISOString();
    const baselineExists = await dependencies.repository.hasAny();
    const existing = await dependencies.repository.find(fingerprints);

    if (!baselineExists) {
      await dependencies.repository.upsert(
        uniqueJobs.map((job) => ({
          fingerprint: job.id,
          sources: job.sources,
          last_discovered_at: now,
          notified_at: now,
        })),
      );
      return emptyResult({ baselined: uniqueJobs.length });
    }

    await dependencies.repository.upsert(
      uniqueJobs.map((job) => ({
        fingerprint: job.id,
        sources: job.sources,
        last_discovered_at: now,
      })),
    );

    const existingById = new Map(existing.map((record) => [record.fingerprint, record]));
    const newFingerprints = uniqueJobs.filter((job) => !existingById.has(job.id)).length;
    const pendingJobs = uniqueJobs.filter((job) => existingById.get(job.id)?.notified_at == null);
    if (pendingJobs.length === 0) return emptyResult({ newFingerprints });

    const enabled = await dependencies.notificationsEnabled();
    if (!enabled) {
      return emptyResult({ newFingerprints, candidates: pendingJobs.length, pending: pendingJobs.length, disabled: true });
    }

    const pendingIds = pendingJobs.map((job) => job.id);
    await dependencies.repository.markAttempted(pendingIds, now);
    const digestResult = await dependencies.sendDigest(pendingJobs.map(toTelegramJob));
    if (digestResult.error) {
      await dependencies.repository.markFailed(pendingIds, now, digestResult.error);
      return emptyResult({
        newFingerprints,
        candidates: pendingJobs.length,
        pending: pendingJobs.length,
        error: digestResult.error,
      });
    }

    const sentCount = Math.min(Math.max(0, digestResult.sentCount), pendingJobs.length);
    const sentIds = pendingIds.slice(0, sentCount);
    if (sentIds.length > 0) await dependencies.repository.markNotified(sentIds, now);
    return emptyResult({
      newFingerprints,
      candidates: pendingJobs.length,
      sent: sentCount,
      pending: pendingJobs.length - sentCount,
    });
  };
}

const productionRepository: FingerprintRepository = {
  async hasAny() {
    const { data, error } = await getSupabase().from('job_fingerprints').select('fingerprint').limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  },
  async find(fingerprints) {
    const rows: FingerprintRecord[] = [];
    for (const batch of batches(fingerprints)) {
      const { data, error } = await getSupabase()
        .from('job_fingerprints')
        .select('fingerprint,notified_at')
        .in('fingerprint', batch);
      if (error) throw error;
      rows.push(...((data ?? []) as FingerprintRecord[]));
    }
    return rows;
  },
  async upsert(records) {
    for (const batch of batches(records)) {
      const { error } = await getSupabase().from('job_fingerprints').upsert(batch, { onConflict: 'fingerprint' });
      if (error) throw error;
    }
  },
  async markAttempted(fingerprints, attemptedAt) {
    await updateFingerprintBatches(fingerprints, {
      notification_attempted_at: attemptedAt,
      notification_error: null,
    });
  },
  async markNotified(fingerprints, notifiedAt) {
    await updateFingerprintBatches(fingerprints, {
      notified_at: notifiedAt,
      notification_error: null,
    });
  },
  async markFailed(fingerprints, attemptedAt, error) {
    await updateFingerprintBatches(fingerprints, {
      notification_attempted_at: attemptedAt,
      notification_error: error,
    });
  },
};

export const processJobNotifications = createJobNotificationService({
  repository: productionRepository,
  async notificationsEnabled() {
    const { data, error } = await getSupabase()
      .from('settings')
      .select('notify_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    return data?.notify_enabled === true;
  },
  sendDigest: sendCombinedJobDigest,
  now: () => new Date(),
});

async function updateFingerprintBatches(fingerprints: string[], patch: Record<string, unknown>): Promise<void> {
  for (const batch of batches(fingerprints)) {
    const { error } = await getSupabase().from('job_fingerprints').update(patch).in('fingerprint', batch);
    if (error) throw error;
  }
}

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += DATABASE_BATCH_SIZE) {
    result.push(values.slice(index, index + DATABASE_BATCH_SIZE));
  }
  return result;
}

function toTelegramJob(job: DiscoveredJob): TelegramJob {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    sources: job.sources,
    url: job.apply_url ?? job.url,
  };
}

function emptyResult(patch: Partial<JobNotificationResult> = {}): JobNotificationResult {
  return {
    baselined: 0,
    newFingerprints: 0,
    candidates: 0,
    sent: 0,
    pending: 0,
    disabled: false,
    error: null,
    ...patch,
  };
}
