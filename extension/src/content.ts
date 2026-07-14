import { decideField, detectAts, type FieldDescriptor } from './field-model';
import type { ContentFillRequest, FillReport } from './messages';

declare global {
  var __koboldContentInstalled: boolean | undefined;
}

if (!globalThis.__koboldContentInstalled) {
  globalThis.__koboldContentInstalled = true;
  chrome.runtime.onMessage.addListener((message: ContentFillRequest, _sender, sendResponse) => {
    if (message.type !== 'KOBOLD_FILL') return false;
    sendResponse(fillPage(message));
    return false;
  });
}

function fillPage(message: ContentFillRequest): FillReport {
  const ats = detectAts(location.hostname);
  const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select',
  ));
  let filled = 0;
  let manual = 0;
  let skipped = 0;
  const filledFields: string[] = [];

  for (const element of fields) {
    element.classList.remove('kobold-filled', 'kobold-review');
    if (!isUsable(element) || hasExistingValue(element)) {
      skipped += 1;
      continue;
    }

    const decision = decideField(describeField(element, ats), message.profile);
    if (decision.action === 'manual') {
      element.classList.add('kobold-review');
      element.dataset.koboldReview = decision.reason;
      manual += 1;
      continue;
    }
    if (decision.action === 'skip') {
      skipped += 1;
      continue;
    }

    setFieldValue(element, decision.value);
    element.classList.add('kobold-filled');
    element.dataset.koboldField = decision.field;
    filled += 1;
    filledFields.push(decision.field);
  }

  return { ats, filled, manual, skipped, filledFields: Array.from(new Set(filledFields)) };
}

function describeField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ats: FieldDescriptor['ats'],
): FieldDescriptor {
  return {
    ats,
    tag: element.tagName.toLowerCase() as FieldDescriptor['tag'],
    type: element instanceof HTMLInputElement ? element.type : element instanceof HTMLSelectElement ? 'select' : 'textarea',
    id: element.id,
    name: element.getAttribute('name') ?? '',
    label: fieldLabel(element),
    placeholder: element.getAttribute('placeholder') ?? '',
    autocomplete: element.getAttribute('autocomplete') ?? '',
    options:
      element instanceof HTMLSelectElement
        ? Array.from(element.options).map((option) => ({ value: option.value, label: option.textContent?.trim() ?? '' }))
        : [],
  };
}

function fieldLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const labels = Array.from(element.labels ?? [])
    .map((label) => label.textContent?.trim() ?? '')
    .filter(Boolean);
  if (labels.length > 0) return labels.join(' ');

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  const container = element.closest('.application-field, .field, [data-testid*="field"], [class*="field"]');
  return container?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? '';
}

function isUsable(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  const readOnly = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.readOnly : false;
  return !element.disabled && !readOnly && element.getAttribute('aria-hidden') !== 'true';
}

function hasExistingValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (element instanceof HTMLInputElement && element.type === 'file') return false;
  if (element instanceof HTMLSelectElement) return element.selectedIndex > 0 && Boolean(element.value);
  return Boolean(element.value.trim());
}

function setFieldValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (element instanceof HTMLSelectElement) {
    element.value = value;
  } else {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, value);
    if (!setter) element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export {};
