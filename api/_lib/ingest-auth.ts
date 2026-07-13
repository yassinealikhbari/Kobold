import { constantTimeEqual } from './auth.js';

export function isAuthorizedIngestCron(input: {
  expectedSecret?: string;
  cronSecret?: string;
  authorization?: string;
  allowVercelAuthorization: boolean;
}): boolean {
  if (!input.expectedSecret) return false;

  if (input.cronSecret && constantTimeEqual(input.cronSecret, input.expectedSecret)) return true;

  return input.allowVercelAuthorization && input.authorization === `Bearer ${input.expectedSecret}`;
}
