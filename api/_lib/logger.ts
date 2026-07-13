type ErrorContext = {
  route?: string;
  method?: string;
  source?: string;
  entityId?: string;
};

export function logServerError(error: unknown, context: ErrorContext = {}): void {
  const details = error instanceof Error ? error : new Error(String(error));

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'api_error',
      timestamp: new Date().toISOString(),
      route: context.route ?? 'unknown',
      method: context.method ?? 'unknown',
      source: context.source,
      entityId: context.entityId,
      error: {
        name: details.name,
        message: details.message,
        stack: details.stack,
      },
    }),
  );
}
