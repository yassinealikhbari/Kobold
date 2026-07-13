export type IngestOutcome = 'success' | 'empty' | 'partial' | 'failed';

export function determineIngestOutcome(input: {
  found: number;
  adapterError?: string | null;
  warnings?: string[];
  notificationError?: string | null;
}): IngestOutcome {
  if (input.adapterError) return 'failed';
  if ((input.warnings?.length ?? 0) > 0 || input.notificationError) return 'partial';
  return input.found === 0 ? 'empty' : 'success';
}

export function combineIngestMessages(messages: Array<string | null | undefined>): string | null {
  const values = messages.flatMap((message) => (message ? [message] : []));
  return values.length > 0 ? values.join(' | ') : null;
}
