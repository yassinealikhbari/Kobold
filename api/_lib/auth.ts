import { timingSafeEqual } from 'node:crypto';

import type { VercelRequest } from '@vercel/node';
import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'vjh_session';
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const encoder = new TextEncoder();

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type Session = {
  sub: 'owner';
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(500, `${name} is not configured`);
  }
  return value;
}

function getSessionSecret(): Uint8Array {
  return encoder.encode(requiredEnv('SESSION_SECRET'));
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const part of header?.split(';') ?? []) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  }

  return cookies;
}

export function getClientIp(req: VercelRequest): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return req.socket.remoteAddress ?? 'unknown';
}

export function verifyPassword(candidate: string): boolean {
  const expected = requiredEnv('APP_PASSWORD');
  return constantTimeEqual(candidate, expected);
}

export function constantTimeEqual(candidate: string, expected: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  const paddedCandidate = Buffer.alloc(expectedBuffer.length);

  candidateBuffer.copy(paddedCandidate, 0, 0, Math.min(candidateBuffer.length, expectedBuffer.length));

  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(expectedBuffer, paddedCandidate);
}

export async function signSession(): Promise<string> {
  return new SignJWT({ sub: 'owner' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSessionSecret());
}

export async function readSession(req: VercelRequest): Promise<Session | null> {
  const token = parseCookies(req.headers.cookie).get(COOKIE_NAME);
  if (!token) return null;

  try {
    const result = await jwtVerify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    });

    return result.payload.sub === 'owner' ? { sub: 'owner' } : null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: VercelRequest): Promise<Session> {
  const session = await readSession(req);
  if (!session) {
    throw new HttpError(401, 'Unauthorized');
  }

  return session;
}

export function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function clearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function sendError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
