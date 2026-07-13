type ErrorContext = {
  route?: string;
  method?: string;
  source?: string;
  entityId?: string;
};

type ErrorDetails = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function describeServerError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      name: asString(record.name) ?? 'Error',
      message: asString(record.message) ?? safeJson(error),
      stack: asString(record.stack),
      code: asString(record.code),
      details: asString(record.details),
      hint: asString(record.hint),
    };
  }

  return { name: 'Error', message: String(error) };
}

export function errorMessage(error: unknown): string {
  return describeServerError(error).message;
}

export function logServerError(error: unknown, context: ErrorContext = {}): void {
  const details = describeServerError(error);

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'api_error',
      timestamp: new Date().toISOString(),
      route: context.route ?? 'unknown',
      method: context.method ?? 'unknown',
      source: context.source,
      entityId: context.entityId,
      error: details,
    }),
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function safeJson(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable error object]';
  }
}
