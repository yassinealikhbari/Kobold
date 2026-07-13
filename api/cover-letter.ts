import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from './_lib/auth.js';
import type { LiveJob } from './_lib/live-jobs.js';
import { getOrCreateProfile } from './_lib/profile.js';

const MAX_INSTRUCTIONS_LENGTH = 1_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await requireAuth(req);
    const job = readJob(req.body?.job);
    const profile = await getOrCreateProfile();
    if (!profile.summary) throw new HttpError(400, 'Complete your profile summary first');
    const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      throw new HttpError(400, `Extra instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer`);
    }
    res.status(200).json({ letter: await generateCoverLetter({ profile, job, instructions }) });
  } catch (error) {
    sendError(res, error, { route: '/api/cover-letter', method: req.method });
  }
}

function readJob(value: unknown): LiveJob {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'A live job snapshot is required');
  const job = value as Partial<LiveJob>;
  if (!job.id || !job.title || !job.company || !job.url) throw new HttpError(400, 'Job snapshot is incomplete');
  return job as LiveJob;
}

async function generateCoverLetter(input: {
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>;
  job: LiveJob;
  instructions: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(502, 'OPENAI_API_KEY is not configured');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 450,
      messages: [
        { role: 'system', content: 'Write a concise, specific 180-250 word software engineering cover letter. Be professional and warm, avoid cliches and fabricated experience. Output plain text only.' },
        { role: 'user', content: buildPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new HttpError(502, 'OpenAI cover letter generation failed');
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const letter = data.choices?.[0]?.message?.content?.trim();
  if (!letter) throw new HttpError(502, 'OpenAI returned an empty cover letter');
  return letter;
}

function buildPrompt(input: { profile: Awaited<ReturnType<typeof getOrCreateProfile>>; job: LiveJob; instructions: string }): string {
  const history = input.profile.work_history.map((work) => `- ${work.role} at ${work.company}: ${work.highlights.filter(Boolean).join('; ')}`).join('\n');
  return [
    `CANDIDATE PROFILE:\n${input.profile.summary}`,
    `Skills: ${input.profile.skills.join(', ')}`,
    `Work history:\n${history}`,
    `JOB: ${input.job.title} at ${input.job.company}\n${(input.job.description_text ?? '').slice(0, 6000)}`,
    input.instructions ? `Extra instructions: ${input.instructions}` : '',
  ].filter(Boolean).join('\n\n');
}
