import { readFile } from 'node:fs/promises';

import formidable from 'formidable';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { getSupabase } from '../_lib/db.js';
import { getOrCreateProfile, normalizeProfile } from '../_lib/profile.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 5 * 1024 * 1024;
const CV_PATH = 'cv.pdf';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAuth(req);

    if (req.method === 'GET') {
      const profile = await getOrCreateProfile();
      if (!profile.cv_path) {
        res.status(404).json({ error: 'No CV uploaded' });
        return;
      }

      const { data, error } = await getSupabase().storage.from('documents').createSignedUrl(profile.cv_path, 600);
      if (error) throw error;

      res.status(200).json({ url: data.signedUrl, path: profile.cv_path });
      return;
    }

    if (req.method === 'POST') {
      const file = await parsePdf(req);
      const bytes = await readFile(file.filepath);
      if (!isPdf(bytes)) throw new HttpError(400, 'The uploaded file is not a valid PDF');

      const { error: uploadError } = await getSupabase().storage.from('documents').upload(CV_PATH, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data, error } = await getSupabase()
        .from('profile')
        .upsert({ id: 1, cv_path: CV_PATH, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) throw error;

      res.status(200).json({ profile: normalizeProfile(data) });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error, { route: '/api/profile/cv', method: req.method });
  }
}

function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
}

async function parsePdf(req: VercelRequest): Promise<formidable.File> {
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_BYTES,
    multiples: false,
  });

  const [, files] = await form.parse(req);
  const value = files.cv;
  const file = Array.isArray(value) ? value[0] : value;

  if (!file) {
    throw new HttpError(400, 'PDF file is required');
  }

  if (file.mimetype !== 'application/pdf') {
    throw new HttpError(400, 'Only PDF uploads are supported');
  }

  if (file.size > MAX_BYTES) {
    throw new HttpError(400, 'CV must be 5 MB or smaller');
  }

  return file;
}
