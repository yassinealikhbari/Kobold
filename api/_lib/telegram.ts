export type TelegramJob = {
  title: string;
  company: string;
  location: string | null;
  workplace: string;
  score: number;
  source: string;
  url: string;
};

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendJobNotifications(jobs: TelegramJob[]): Promise<string | null> {
  if (jobs.length === 0) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  const messages = jobs.length <= 3 ? jobs.map(formatJob) : [formatDigest(jobs)];

  for (const text of messages) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      return `Telegram send failed with ${response.status}`;
    }
  }

  return null;
}

function formatJob(job: TelegramJob): string {
  return [
    `New job: ${job.title}`,
    `${job.company} · ${job.location ?? 'Unknown'} · ${job.workplace}`,
    `Score ${job.score} · via ${job.source}`,
    job.url,
  ].join('\n');
}

function formatDigest(jobs: TelegramJob[]): string {
  return [
    `${jobs.length} new matching jobs`,
    ...jobs.map((job) => `- ${job.title} at ${job.company} · score ${job.score} · ${job.url}`),
  ].join('\n');
}
