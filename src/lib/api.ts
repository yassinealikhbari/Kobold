export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body: requestBody, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    ...requestOptions,
    headers,
    credentials: 'include',
  };

  if (requestBody !== undefined && !(requestBody instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(requestBody);
  } else {
    init.body = requestBody;
  }

  const response = await fetch(`/api${path}`, init);
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (response.status === 401 && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with ${response.status}`, response.status, body);
  }

  return body as T;
}
