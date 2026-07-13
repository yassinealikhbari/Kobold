import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth, sendError } from '../_lib/auth';
import { getSupabase } from '../_lib/db';
import { getOrCreateProfile, normalizeProfile, profileUpdatePayload } from '../_lib/profile';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      res.status(200).json({ profile: await getOrCreateProfile() });
      return;
    }

    if (req.method === 'PUT') {
      const payload = profileUpdatePayload(req.body ?? {});
      const { data, error } = await getSupabase()
        .from('profile')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) throw error;
      res.status(200).json({ profile: normalizeProfile(data) });
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}
