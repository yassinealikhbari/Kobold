import { randomUUID } from 'node:crypto';

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError, requireAuth, sendError } from '../_lib/auth.js';
import { parseCsv } from '../_lib/csv.js';
import {
  contactPayload,
  organizationPayload,
  opportunityPayload,
  queryBoolean,
} from '../_lib/crm-validation.js';
import { getSupabase } from '../_lib/db.js';
import {
  buildDedupeIndex,
  buildOrganizationCreatePayload,
  buildOrganizationUpdatePayload,
  normalizeDomain,
  parseLeadRow,
  planContactForRow,
  planOpportunityForRow,
  resolveOrganizationMatch,
  type ContactLite,
  type DedupeIndex,
  type OpportunityLite,
  type OrganizationLite,
} from '../_lib/lead-import.js';

const MAX_CSV_LENGTH = 2_000_000;

type RowResult = {
  row_number: number;
  business: string;
  place_id: string | null;
  organization_action: 'create' | 'update' | 'skip';
  organization_match: 'place_id' | 'domain' | 'phone' | 'none';
  organization_id?: string;
  contact_action: 'create' | 'update' | 'none';
  opportunity_action: 'create' | 'skip';
  warnings: string[];
};

type RowError = { row_number: number; error: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    await requireAuth(req);
    const db = getSupabase();

    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) throw new HttpError(400, 'A csv field with CSV text is required');
    if (csv.length > MAX_CSV_LENGTH) throw new HttpError(400, 'CSV is too large');
    const dryRun = queryBoolean(req.query.dry_run, 'dry_run') ?? false;

    const parsedRows = parseCsv(csv);
    const [organizations, contacts, opportunities] = await Promise.all([
      fetchOrganizations(db),
      fetchActiveContacts(db),
      fetchOpportunities(db),
    ]);
    const index = buildDedupeIndex(organizations, contacts);
    const contactsByOrg = groupContactsByOrganization(contacts);
    const opportunitiesByOrg = groupOpportunitiesByOrganization(opportunities);

    const results: RowResult[] = [];
    const rowErrors: RowError[] = [];
    const totals = {
      rows_parsed: parsedRows.length,
      organizations_created: 0,
      organizations_updated: 0,
      organizations_skipped: 0,
      contacts_created: 0,
      contacts_updated: 0,
      contacts_skipped: 0,
      opportunities_created: 0,
    };

    for (const [offset, raw] of parsedRows.entries()) {
      const rowNumber = offset + 2;
      try {
        const parsed = parseLeadRow(raw);
        if ('error' in parsed) {
          rowErrors.push({ row_number: rowNumber, error: parsed.error });
          continue;
        }
        const row = parsed.row;
        const match = resolveOrganizationMatch(row, index);
        const warnings = match.warning ? [match.warning] : [];

        if (match.organization?.archived_at) {
          totals.organizations_skipped += 1;
          results.push({
            row_number: rowNumber,
            business: row.business,
            place_id: row.placeId,
            organization_action: 'skip',
            organization_match: match.matchedBy,
            organization_id: match.organization.id,
            contact_action: 'none',
            opportunity_action: 'skip',
            warnings: [...warnings, 'Matched an archived organization; left untouched.'],
          });
          continue;
        }

        let organizationId: string;
        let organizationAction: RowResult['organization_action'];

        if (!match.organization) {
          const validated = organizationPayload(buildOrganizationCreatePayload(row), false);
          if (dryRun) {
            // Contact/opportunity payloads require a real-shaped UUID to pass validation
            // even though nothing is written; the id never leaves this preview response.
            organizationId = randomUUID();
          } else {
            const { data, error } = await db.from('organizations').insert(validated).select('*').single();
            if (error) throw error;
            organizationId = data.id as string;
            await logActivity(db, 'organization', organizationId, row.business, 'Imported from Clay CSV lead list.', {
              source: 'clay_csv_import',
              place_id: row.placeId,
            });
            registerCreatedOrganization(index, contactsByOrg, opportunitiesByOrg, organizationId, data as OrganizationLite);
          }
          organizationAction = 'create';
          totals.organizations_created += 1;
        } else {
          const { payload, changed } = buildOrganizationUpdatePayload(match.organization, row);
          organizationId = match.organization.id;
          if (!changed) {
            organizationAction = 'skip';
            totals.organizations_skipped += 1;
          } else {
            const validated = organizationPayload(payload, true);
            if (!dryRun) {
              const { error } = await db
                .from('organizations')
                .update({ ...validated, updated_at: new Date().toISOString() })
                .eq('id', organizationId);
              if (error) throw error;
              await logActivity(db, 'organization', organizationId, row.business, 'Updated from Clay CSV lead list.', {
                source: 'clay_csv_import',
                place_id: row.placeId,
                changed_fields: Object.keys(payload),
              });
              Object.assign(match.organization, validated);
            }
            organizationAction = 'update';
            totals.organizations_updated += 1;
          }
        }

        const existingContacts = contactsByOrg.get(organizationId) ?? [];
        const contactPlan = planContactForRow(row, organizationId, existingContacts);
        let contactAction: RowResult['contact_action'] = 'none';
        if (contactPlan.action === 'create') {
          const validated = contactPayload(contactPlan.payload, false);
          if (!dryRun) {
            const { data, error } = await db.from('contacts').insert(validated).select('*').single();
            if (error) throw error;
            existingContacts.push(data as ContactLite);
            contactsByOrg.set(organizationId, existingContacts);
          }
          contactAction = 'create';
          totals.contacts_created += 1;
        } else if (contactPlan.action === 'update') {
          const validated = contactPayload(contactPlan.payload, true);
          if (!dryRun) {
            const { error } = await db
              .from('contacts')
              .update({ ...validated, updated_at: new Date().toISOString() })
              .eq('id', contactPlan.contactId);
            if (error) throw error;
            const target = existingContacts.find((item) => item.id === contactPlan.contactId);
            if (target) Object.assign(target, validated);
          }
          contactAction = 'update';
          totals.contacts_updated += 1;
        } else {
          totals.contacts_skipped += 1;
        }

        const existingOpportunities = opportunitiesByOrg.get(organizationId) ?? [];
        const opportunityPlan = planOpportunityForRow(row, organizationId, existingOpportunities);
        if (opportunityPlan.action === 'create') {
          const validated = opportunityPayload(opportunityPlan.payload, false);
          if (!dryRun) {
            const { data, error } = await db.from('opportunities').insert(validated).select('*').single();
            if (error) throw error;
            existingOpportunities.push(data as OpportunityLite);
            opportunitiesByOrg.set(organizationId, existingOpportunities);
          }
          totals.opportunities_created += 1;
        }

        results.push({
          row_number: rowNumber,
          business: row.business,
          place_id: row.placeId,
          organization_action: organizationAction,
          organization_match: match.matchedBy,
          organization_id: dryRun && organizationAction === 'create' ? undefined : organizationId,
          contact_action: contactAction,
          opportunity_action: opportunityPlan.action,
          warnings,
        });
      } catch (rowError) {
        rowErrors.push({ row_number: rowNumber, error: describeRowError(rowError) });
      }
    }

    res.status(200).json({ dry_run: dryRun, totals, rows: results, row_errors: rowErrors });
  } catch (error) {
    sendError(res, error, { route: '/api/leads/import', method: req.method });
  }
}

async function fetchOrganizations(db: ReturnType<typeof getSupabase>): Promise<OrganizationLite[]> {
  const { data, error } = await db
    .from('organizations')
    .select(
      'id,name,website,industry,district,postcode,notes,address,lead_score,lead_score_reason,missing_function,staleness_evidence,hook_verified,source_place_id,archived_at,updated_at',
    );
  if (error) throw error;
  return (data ?? []) as OrganizationLite[];
}

async function fetchActiveContacts(db: ReturnType<typeof getSupabase>): Promise<ContactLite[]> {
  const { data, error } = await db
    .from('contacts')
    .select('id,organization_id,full_name,phone,email,is_primary,archived_at')
    .is('archived_at', null);
  if (error) throw error;
  return (data ?? []) as ContactLite[];
}

async function fetchOpportunities(db: ReturnType<typeof getSupabase>): Promise<OpportunityLite[]> {
  const { data, error } = await db.from('opportunities').select('id,organization_id,stage,archived_at');
  if (error) throw error;
  return (data ?? []) as OpportunityLite[];
}

function groupContactsByOrganization(contacts: ContactLite[]): Map<string, ContactLite[]> {
  const byOrg = new Map<string, ContactLite[]>();
  for (const contact of contacts) {
    if (!contact.organization_id) continue;
    const list = byOrg.get(contact.organization_id) ?? [];
    list.push(contact);
    byOrg.set(contact.organization_id, list);
  }
  return byOrg;
}

function groupOpportunitiesByOrganization(opportunities: OpportunityLite[]): Map<string, OpportunityLite[]> {
  const byOrg = new Map<string, OpportunityLite[]>();
  for (const opportunity of opportunities) {
    const list = byOrg.get(opportunity.organization_id) ?? [];
    list.push(opportunity);
    byOrg.set(opportunity.organization_id, list);
  }
  return byOrg;
}

function registerCreatedOrganization(
  index: DedupeIndex,
  contactsByOrg: Map<string, ContactLite[]>,
  opportunitiesByOrg: Map<string, OpportunityLite[]>,
  organizationId: string,
  organization: OrganizationLite,
) {
  index.orgsById.set(organizationId, organization);
  if (organization.source_place_id) index.byPlaceId.set(organization.source_place_id, organization);
  const host = normalizeDomain(organization.website);
  if (host) {
    const list = index.byDomain.get(host) ?? [];
    list.push(organization);
    index.byDomain.set(host, list);
  }
  contactsByOrg.set(organizationId, []);
  opportunitiesByOrg.set(organizationId, []);
}

async function logActivity(
  db: ReturnType<typeof getSupabase>,
  subjectType: 'organization',
  subjectId: string,
  label: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('activities').insert({
    subject_type: subjectType,
    subject_id: subjectId,
    subject_label: label,
    subject_path: `/freelance/organizations/${subjectId}`,
    kind: 'system',
    body,
    metadata,
  });
  if (error) throw error;
}

function describeRowError(error: unknown): string {
  if (error instanceof HttpError) {
    const fields = (error.details?.fields ?? {}) as Record<string, string>;
    const detail = Object.values(fields)[0];
    return detail ? `${error.message}: ${detail}` : error.message;
  }
  return error instanceof Error ? error.message : 'Import failed for this row';
}
