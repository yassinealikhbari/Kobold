export type TelegramJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplace: string;
  score: number;
  source: string;
};

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID && process.env.APP_URL);
}

export async function sendJobNotifications(jobs: TelegramJob[]): Promise<string | null> {
  if (jobs.length === 0) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const appUrl = process.env.APP_URL;
  if (!token || !chatId || !appUrl) return null;

  const messages = jobs.length <= 3 ? jobs.map((job) => formatJob(job, appUrl)) : [formatDigest(jobs, appUrl)];

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

function formatJob(job: TelegramJob, appUrl: string): string {
  return [
    `New job: ${job.title}`,
    `${job.company} · ${job.location ?? 'Unknown'} · ${job.workplace}`,
    `Score ${job.score} · via ${job.source}`,
    `${appUrl.replace(/\/$/, '')}/jobs/${job.id}`,
  ].join('\n');
}

function formatDigest(jobs: TelegramJob[], appUrl: string): string {
  return [
    `${jobs.length} new matching jobs`,
    ...jobs.map((job) => `- ${job.title} at ${job.company} · score ${job.score} · ${appUrl.replace(/\/$/, '')}/jobs/${job.id}`),
  ].join('\n');
}
