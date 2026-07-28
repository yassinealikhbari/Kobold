import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it } from 'vitest';

import activities from '../activities/[id].js';
import contacts from '../contacts/[id].js';
import opportunities from '../opportunities/[id].js';
import organizations from '../organizations/[id].js';
import system from '../system/[resource].js';
import tasks from '../tasks/[id].js';
import templates from '../templates/[id].js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const routes: Array<{
  route: string;
  method: string;
  handler: Handler;
  query?: Record<string, string>;
}> = [
  { route: '/api/organizations', method: 'GET', handler: organizations, query: { id: '_collection' } },
  { route: '/api/organizations/[id]', method: 'GET', handler: organizations, query: { id: 'test-id' } },
  { route: '/api/contacts', method: 'GET', handler: contacts, query: { id: '_collection' } },
  { route: '/api/contacts/[id]', method: 'GET', handler: contacts, query: { id: 'test-id' } },
  { route: '/api/opportunities', method: 'GET', handler: opportunities, query: { id: '_collection' } },
  { route: '/api/opportunities/[id]', method: 'GET', handler: opportunities, query: { id: 'test-id' } },
  { route: '/api/activities', method: 'GET', handler: activities, query: { id: '_collection' } },
  { route: '/api/activities/[id]', method: 'DELETE', handler: activities, query: { id: 'test-id' } },
  { route: '/api/tasks', method: 'GET', handler: tasks, query: { id: '_collection' } },
  { route: '/api/tasks/[id]', method: 'PATCH', handler: tasks, query: { id: 'test-id' } },
  { route: '/api/templates', method: 'GET', handler: templates, query: { id: '_collection' } },
  { route: '/api/templates/[id]', method: 'PATCH', handler: templates, query: { id: 'test-id' } },
  { route: '/api/audit', method: 'GET', handler: system, query: { resource: 'audit' } },
  { route: '/api/metrics', method: 'GET', handler: system, query: { resource: 'metrics' } },
  { route: '/api/export', method: 'GET', handler: system, query: { resource: 'export' } },
  { route: '/api/task-digest', method: 'POST', handler: system, query: { resource: 'task-digest' } },
  { route: '/api/leads/import', method: 'POST', handler: system, query: { resource: 'leads-import' } },
];

describe.each(routes)('$method $route authorization', ({ method, handler, query }) => {
  it('rejects a request without a session before accessing route data', async () => {
    const request = {
      method,
      headers: {},
      query: query ?? {},
      body: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as VercelRequest;
    let statusCode = 0;
    let body: unknown;
    const response = {
      setHeader: () => response,
      status: (code: number) => {
        statusCode = code;
        return response;
      },
      json: (value: unknown) => {
        body = value;
        return response;
      },
      send: (value: unknown) => {
        body = value;
        return response;
      },
    } as unknown as VercelResponse;

    await handler(request, response);

    expect(statusCode).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});
