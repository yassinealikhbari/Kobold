import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const source = typeof req.query.source === 'string' ? req.query.source : null;

  res.status(501).json({
    error: 'Ingest pipeline is not implemented yet.',
    source,
  });
}
