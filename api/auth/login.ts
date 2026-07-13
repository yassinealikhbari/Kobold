import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getClientIp, sendError, sessionCookie, signSession, verifyPassword } from '../_lib/auth';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type FailureWindow = {
  count: number;
  firstFailureAt: number;
};

const globalWithFailures = globalThis as typeof globalThis & {
  __vjhLoginFailures?: Map<string, FailureWindow>;
};

const failures = globalWithFailures.__vjhLoginFailures ?? new Map<string, FailureWindow>();
globalWithFailures.__vjhLoginFailures = failures;

function isLimited(ip: string, now: number): boolean {
  const current = failures.get(ip);
  if (!current) return false;

  if (now - current.firstFailureAt > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }

  return current.count >= MAX_FAILURES;
}

function recordFailure(ip: string, now: number) {
  const current = failures.get(ip);
  if (!current || now - current.firstFailureAt > WINDOW_MS) {
    failures.set(ip, { count: 1, firstFailureAt: now });
    return;
  }

  current.count += 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const ip = getClientIp(req);
    const now = Date.now();

    if (isLimited(ip, now)) {
      res.status(429).json({ error: 'Too many login attempts' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!verifyPassword(password)) {
      recordFailure(ip, now);
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    failures.delete(ip);
    res.setHeader('Set-Cookie', sessionCookie(await signSession()));
    res.status(200).json({ authenticated: true });
  } catch (error) {
    sendError(res, error);
  }
}
