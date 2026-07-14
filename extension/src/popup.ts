import type { ExtensionState, FillReport, RuntimeRequest, RuntimeResponse } from './messages';

const fillButton = requiredElement<HTMLButtonElement>('fill-button');
const syncButton = requiredElement<HTMLButtonElement>('sync-button');
const clearButton = requiredElement<HTMLButtonElement>('clear-button');
const profileStatus = requiredElement<HTMLElement>('profile-status');
const syncTime = requiredElement<HTMLElement>('sync-time');
const result = requiredElement<HTMLElement>('result');
const runtimeAvailable = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

if (runtimeAvailable) {
  fillButton.addEventListener('click', () => void runAction('FILL_ACTIVE_TAB', 'Filling'));
  syncButton.addEventListener('click', () => void runAction('SYNC_PROFILE', 'Syncing'));
  clearButton.addEventListener('click', () => void runAction('CLEAR_PROFILE', 'Clearing'));
  void loadState();
} else {
  profileStatus.textContent = 'Preview';
  syncTime.textContent = 'Load extension/dist in Chrome';
  fillButton.disabled = true;
  syncButton.disabled = true;
}

async function loadState(): Promise<void> {
  const response = await send({ type: 'GET_STATE' });
  if (!response.ok) {
    showError(response.error);
    return;
  }
  renderState(response.state);
}

async function runAction(type: RuntimeRequest['type'], busyLabel: string): Promise<void> {
  setBusy(true, busyLabel);
  hideResult();
  try {
    const response = await send({ type } as RuntimeRequest);
    if (!response.ok) {
      showError(response.error);
      return;
    }
    if (response.state) renderState(response.state);
    if (response.report) showReport(response.report);
  } finally {
    setBusy(false);
  }
}

function renderState(state?: ExtensionState): void {
  const synced = state?.synced === true;
  profileStatus.textContent = synced ? state.fullName || 'Synced' : 'Not synced';
  syncTime.textContent = state?.syncedAt ? `Synced ${new Date(state.syncedAt).toLocaleString()}` : '';
  fillButton.disabled = !synced;
  clearButton.hidden = !synced;
}

function showReport(report: FillReport): void {
  result.hidden = false;
  result.className = 'result is-success';
  result.replaceChildren(
    line('Filled', String(report.filled)),
    line('Manual review', String(report.manual)),
    line('Detected', report.ats),
  );
}

function showError(message: string): void {
  result.hidden = false;
  result.className = 'result is-error';
  result.replaceChildren(line('Error', message));
}

function hideResult(): void {
  result.hidden = true;
  result.replaceChildren();
}

function line(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  const name = document.createElement('span');
  const content = document.createElement('strong');
  name.textContent = label;
  content.textContent = value;
  row.append(name, content);
  return row;
}

function setBusy(busy: boolean, label = ''): void {
  fillButton.disabled = busy || profileStatus.textContent === 'Not synced';
  syncButton.disabled = busy;
  clearButton.disabled = busy;
  if (busy) profileStatus.textContent = label;
  if (!busy) void loadState();
}

async function send(message: RuntimeRequest): Promise<RuntimeResponse> {
  if (!runtimeAvailable) return { ok: false, error: 'Extension runtime is unavailable' };
  return (await chrome.runtime.sendMessage(message)) as RuntimeResponse;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element as T;
}
