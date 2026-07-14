const TELEGRAM_MESSAGE_LIMIT = 3_900;

export type TelegramJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  sources: string[];
  url: string;
};

export type TelegramDigest = {
  text: string;
  included: number;
};

export type TelegramDigestResult = {
  sentCount: number;
  error: string | null;
};

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendCombinedJobDigest(jobs: TelegramJob[]): Promise<TelegramDigestResult> {
  if (jobs.length === 0) return { sentCount: 0, error: null };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sentCount: 0, error: 'Telegram credentials are not configured' };

  const digest = buildCombinedTelegramDigest(jobs);
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: digest.text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    return { sentCount: 0, error: `Telegram send failed with ${response.status}` };
  }

  return { sentCount: digest.included, error: null };
}

export function buildCombinedTelegramDigest(
  jobs: TelegramJob[],
  maxLength = TELEGRAM_MESSAGE_LIMIT,
): TelegramDigest {
  const header = `KOBOLD - ${jobs.length} new eligible ${jobs.length === 1 ? 'job' : 'jobs'}`;
  const entries = jobs.map(formatDigestEntry);
  const includedEntries: string[] = [];

  for (const entry of entries) {
    const remaining = jobs.length - includedEntries.length - 1;
    const footer = remaining > 0 ? `\n\n+${remaining} more queued for the next digest.` : '';
    const candidate = [header, ...includedEntries, entry].join('\n\n') + footer;
    if (candidate.length > maxLength) break;
    includedEntries.push(entry);
  }

  if (includedEntries.length === 0) {
    const first = entries[0]?.slice(0, Math.max(0, maxLength - header.length - 2)) ?? '';
    return { text: `${header}\n\n${first}`.slice(0, maxLength), included: first ? 1 : 0 };
  }

  const remaining = jobs.length - includedEntries.length;
  const footer = remaining > 0 ? `\n\n+${remaining} more queued for the next digest.` : '';
  return {
    text: [header, ...includedEntries].join('\n\n') + footer,
    included: includedEntries.length,
  };
}

function formatDigestEntry(job: TelegramJob, index: number): string {
  const source = job.sources.slice(0, 2).join(' + ');
  return [
    `${index + 1}. ${compact(job.title, 90)}`,
    `${compact(job.company, 55)} - ${compact(job.location ?? 'Location to verify', 55)} - ${source}`,
    job.url,
  ].join('\n');
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}
