import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth';
import { getSupabase } from '../_lib/db';
import { sourceAdapters } from '../_lib/sources';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAuth(req);

    const { data, error } = await getSupabase()
      .from('ingest_runs')
      .select('*')
      .in('source', [...sourceAdapters.map((adapter) => adapter.name), 'lifecycle'])
      .order('started_at', { ascending: false })
      .limit(80);

    if (error) throw error;

    const latestBySource = new Map<string, unknown>();
    for (const run of data ?? []) {
      const source = typeof run.source === 'string' ? run.source : '';
      if (source && !latestBySource.has(source)) latestBySource.set(source, run);
    }

    res.status(200).json({ runs: Array.from(latestBySource.values()) });
  } catch (error) {
    sendError(res, error);
  }
}
