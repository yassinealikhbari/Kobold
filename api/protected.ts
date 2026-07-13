import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);
    res.status(200).json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
}
