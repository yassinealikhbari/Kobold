import type { ContentFillRequest, ExtensionState, FillReport, RuntimeRequest, RuntimeResponse } from './messages';
import { toExtensionProfile, type ExtensionProfile } from './profile';

const APP_ORIGIN = 'https://kobold-gamma.vercel.app';
const STORAGE_KEY = 'koboldSyncedProfile';

type StoredProfile = {
  profile: ExtensionProfile;
  syncedAt: string;
};

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Extension request failed' });
    });
  return true;
});

async function handleMessage(message: RuntimeRequest): Promise<RuntimeResponse> {
  if (message.type === 'GET_STATE') return { ok: true, state: await getState() };
  if (message.type === 'SYNC_PROFILE') {
    await syncProfile();
    return { ok: true, state: await getState() };
  }
  if (message.type === 'CLEAR_PROFILE') {
    await chrome.storage.local.remove(STORAGE_KEY);
    return { ok: true, state: await getState() };
  }
  if (message.type === 'FILL_ACTIVE_TAB') {
    return { ok: true, report: await fillActiveTab() };
  }
  return { ok: false, error: 'Unknown extension request' };
}

async function syncProfile(): Promise<void> {
  const response = await fetch(`${APP_ORIGIN}/api/profile`, { credentials: 'include' });
  if (response.status === 401) throw new Error('Sign in to KOBOLD in this browser, then sync again');
  if (!response.ok) throw new Error(`KOBOLD profile sync failed with ${response.status}`);

  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !('profile' in body)) throw new Error('KOBOLD returned an invalid profile response');
  const stored: StoredProfile = {
    profile: toExtensionProfile(body.profile),
    syncedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
}

async function fillActiveTab(): Promise<FillReport> {
  const stored = await getStoredProfile();
  if (!stored) throw new Error('Sync your KOBOLD profile first');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error('Open a web application form before filling');
  }

  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const request: ContentFillRequest = { type: 'KOBOLD_FILL', profile: stored.profile };
  return (await chrome.tabs.sendMessage(tab.id, request)) as FillReport;
}

async function getState(): Promise<ExtensionState> {
  const stored = await getStoredProfile();
  return {
    synced: Boolean(stored),
    syncedAt: stored?.syncedAt ?? null,
    fullName: stored?.profile.fullName || null,
  };
}

async function getStoredProfile(): Promise<StoredProfile | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const value = result[STORAGE_KEY] as unknown;
  if (!isRecord(value) || !isRecord(value.profile) || typeof value.syncedAt !== 'string') return null;
  return value as StoredProfile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
