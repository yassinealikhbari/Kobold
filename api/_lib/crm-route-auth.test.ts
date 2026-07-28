import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it } from 'vitest';

import activitiesItem from '../activities/[id].js';
import activitiesCollection from '../activities/index.js';
import audit from '../audit.js';
import contactsItem from '../contacts/[id].js';
import contactsCollection from '../contacts/index.js';
import exportData from '../export.js';
import leadsImport from '../leads/import.js';
import metrics from '../metrics.js';
import opportunitiesItem from '../opportunities/[id].js';
import opportunitiesCollection from '../opportunities/index.js';
import organizationsItem from '../organizations/[id].js';
import organizationsCollection from '../organizations/index.js';
import taskDigest from '../task-digest.js';
import tasksItem from '../tasks/[id].js';
import tasksCollection from '../tasks/index.js';
import templatesItem from '../templates/[id].js';
import templatesCollection from '../templates/index.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const routes: Array<{ route: string; method: string; handler: Handler }> = [
  { route: '/api/organizations', method: 'GET', handler: organizationsCollection },
  { route: '/api/organizations/[id]', method: 'GET', handler: organizationsItem },
  { route: '/api/contacts', method: 'GET', handler: contactsCollection },
  { route: '/api/contacts/[id]', method: 'GET', handler: contactsItem },
  { route: '/api/opportunities', method: 'GET', handler: opportunitiesCollection },
  { route: '/api/opportunities/[id]', method: 'GET', handler: opportunitiesItem },
  { route: '/api/activities', method: 'GET', handler: activitiesCollection },
  { route: '/api/activities/[id]', method: 'DELETE', handler: activitiesItem },
  { route: '/api/tasks', method: 'GET', handler: tasksCollection },
  { route: '/api/tasks/[id]', method: 'PATCH', handler: tasksItem },
  { route: '/api/audit', method: 'GET', handler: audit },
  { route: '/api/templates', method: 'GET', handler: templatesCollection },
  { route: '/api/templates/[id]', method: 'PATCH', handler: templatesItem },
  { route: '/api/metrics', method: 'GET', handler: metrics },
  { route: '/api/export', method: 'GET', handler: exportData },
  { route: '/api/leads/import', method: 'POST', handler: leadsImport },
  { route: '/api/task-digest', method: 'POST', handler: taskDigest },
];

describe.each(routes)('$method $route authorization', ({ method, handler }) => {
  it('rejects a request without a session before accessing route data', async () => {
    const request = {
      method,
      headers: {},
      query: {},
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
