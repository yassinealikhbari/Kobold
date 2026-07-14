import type { ExtensionProfile } from './profile';

export type FillReport = {
  ats: string;
  filled: number;
  manual: number;
  skipped: number;
  filledFields: string[];
};

export type ExtensionState = {
  synced: boolean;
  syncedAt: string | null;
  fullName: string | null;
};

export type RuntimeRequest =
  | { type: 'GET_STATE' }
  | { type: 'SYNC_PROFILE' }
  | { type: 'CLEAR_PROFILE' }
  | { type: 'FILL_ACTIVE_TAB' };

export type ContentFillRequest = {
  type: 'KOBOLD_FILL';
  profile: ExtensionProfile;
};

export type RuntimeResponse =
  | { ok: true; state?: ExtensionState; report?: FillReport }
  | { ok: false; error: string };
