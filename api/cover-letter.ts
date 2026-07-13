import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from './_lib/auth.js';
import { getOrCreateApplication, updateApplication } from './_lib/applications.js';
import { getJobById } from './_lib/jobs.js';
import { getOrCreateProfile } from './_lib/profile.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAuth(req);

    const jobId = typeof req.body?.job_id === 'string' ? req.body.job_id : '';
    if (!jobId) throw new HttpError(400, 'job_id is required');

    const [profile, job] = await Promise.all([getOrCreateProfile(), getJobById(jobId)]);
    if (!job) throw new HttpError(404, 'Job not found');
    if (!profile.summary) throw new HttpError(400, 'Complete your profile summary first');

    const letter = await generateCoverLetter({
      profile,
      job,
      instructions: typeof req.body?.instructions === 'string' ? req.body.instructions : '',
    });

    const application = await getOrCreateApplication(job.id);
    const updatedApplication = await updateApplication(application.id, { cover_letter: letter });

    res.status(200).json({ letter, application: updatedApplication });
  } catch (error) {
    sendError(res, error);
  }
}

async function generateCoverLetter(input: {
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>;
  job: NonNullable<Awaited<ReturnType<typeof getJobById>>>;
  instructions: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(502, 'OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content:
            'You write concise, specific cover letters for software engineering applications. 180-250 words, professional but warm, no clichés ("passionate", "rockstar"), no fabricated experience. Structure: hook tied to the company product, 2 concrete matches between candidate experience and the role requirements, brief close. Output plain text only, no header/date block.',
        },
        {
          role: 'user',
          content: buildPrompt(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new HttpError(502, 'OpenAI cover letter generation failed');
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const letter = data.choices?.[0]?.message?.content?.trim();
  if (!letter) throw new HttpError(502, 'OpenAI returned an empty cover letter');

  return letter;
}

function buildPrompt(input: {
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>;
  job: NonNullable<Awaited<ReturnType<typeof getJobById>>>;
  instructions: string;
}): string {
  const workHistory = input.profile.work_history
    .map((work) => {
      const highlights = work.highlights.filter(Boolean).map((highlight) => `  - ${highlight}`).join('\n');
      return `- ${work.role} at ${work.company} (${work.from}-${work.to})\n${highlights}`;
    })
    .join('\n');

  return [
    `CANDIDATE PROFILE:\n${input.profile.summary}`,
    `Skills: ${input.profile.skills.join(', ')}`,
    `Work history:\n${workHistory}`,
    `Languages: ${input.profile.languages.map((language) => `${language.lang} ${language.level}`).join(', ')}`,
    `JOB: ${input.job.title} at ${input.job.company}\n${(input.job.description_text ?? '').slice(0, 6000)}`,
    input.instructions ? `Extra instructions: ${input.instructions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
