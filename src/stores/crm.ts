import { defineStore } from 'pinia';

import { ApiError, apiFetch } from '@/lib/api';
import type {
  Contact,
  ContactDraft,
  Organization,
  OrganizationDraft,
  OrganizationFilters,
  Opportunity,
} from '@/types/crm';

type FieldErrors = Record<string, string>;

const emptyFilters = (): OrganizationFilters => ({
  q: '',
  status: '',
  language: '',
  district: '',
  has_website: '',
  archived: false,
});

export const useCrmStore = defineStore('crm', {
  state: () => ({
    organizations: [] as Organization[],
    contacts: [] as Contact[],
    selectedOrganization: null as Organization | null,
    organizationContacts: [] as Contact[],
    organizationOpportunities: [] as Opportunity[],
    filters: emptyFilters(),
    loading: false,
    saving: false,
    error: null as string | null,
    warning: null as string | null,
    fieldErrors: {} as FieldErrors,
  }),
  actions: {
    clearFeedback() {
      this.error = null;
      this.warning = null;
      this.fieldErrors = {};
    },
    async fetchOrganizations() {
      this.loading = true;
      this.error = null;
      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(this.filters)) {
          if (value !== '' && value !== false) params.set(key, String(value));
        }
        const query = params.size ? `?${params.toString()}` : '';
        const response = await apiFetch<{ organizations: Organization[] }>(`/organizations${query}`);
        this.organizations = response.organizations;
      } catch (error) {
        this.captureError(error, 'Failed to load organizations');
      } finally {
        this.loading = false;
      }
    },
    async fetchOrganization(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiFetch<{
          organization: Organization;
          contacts: Contact[];
          opportunities?: Opportunity[];
        }>(
          `/organizations/${id}`,
        );
        this.selectedOrganization = response.organization;
        this.organizationContacts = response.contacts;
        this.organizationOpportunities = response.opportunities ?? [];
      } catch (error) {
        this.captureError(error, 'Failed to load organization');
      } finally {
        this.loading = false;
      }
    },
    async createOrganization(draft: OrganizationDraft): Promise<Organization | null> {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{
          organization: Organization;
          warnings: string[];
        }>('/organizations', { method: 'POST', body: draft });
        this.organizations.unshift(response.organization);
        this.warning = response.warnings[0] ?? null;
        return response.organization;
      } catch (error) {
        this.captureError(error, 'Failed to create organization');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateOrganization(
      id: string,
      patch: Partial<OrganizationDraft> & { archived?: false },
    ): Promise<Organization | null> {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{ organization: Organization }>(`/organizations/${id}`, {
          method: 'PATCH',
          body: patch,
        });
        this.mergeOrganization(response.organization);
        return response.organization;
      } catch (error) {
        this.captureError(error, 'Failed to update organization');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async archiveOrganization(id: string) {
      this.clearFeedback();
      try {
        const response = await apiFetch<{ organization: Organization }>(`/organizations/${id}`, {
          method: 'DELETE',
        });
        this.organizations = this.organizations.filter((item) => item.id !== id);
        if (this.selectedOrganization?.id === id) this.selectedOrganization = response.organization;
      } catch (error) {
        this.captureError(error, 'Failed to archive organization');
      }
    },
    async restoreOrganization(id: string) {
      const organization = await this.updateOrganization(id, { archived: false });
      if (organization && !this.organizations.some((item) => item.id === organization.id)) {
        this.organizations.unshift(organization);
      }
      return organization;
    },
    async fetchContacts(organizationId?: string, archived = false) {
      this.loading = true;
      this.error = null;
      try {
        const params = new URLSearchParams();
        if (organizationId) params.set('organization_id', organizationId);
        if (archived) params.set('archived', 'true');
        const query = params.size ? `?${params.toString()}` : '';
        const response = await apiFetch<{ contacts: Contact[] }>(`/contacts${query}`);
        this.contacts = response.contacts;
      } catch (error) {
        this.captureError(error, 'Failed to load contacts');
      } finally {
        this.loading = false;
      }
    },
    async createContact(draft: ContactDraft): Promise<Contact | null> {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{ contact: Contact }>('/contacts', {
          method: 'POST',
          body: draft,
        });
        this.contacts.unshift(response.contact);
        if (response.contact.organization_id === this.selectedOrganization?.id) {
          if (response.contact.is_primary) {
            this.organizationContacts = this.organizationContacts.map((item) => ({
              ...item,
              is_primary: false,
            }));
          }
          this.organizationContacts.unshift(response.contact);
        }
        return response.contact;
      } catch (error) {
        this.captureError(error, 'Failed to create contact');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateContact(id: string, patch: Partial<ContactDraft> & { archived?: false }) {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{ contact: Contact }>(`/contacts/${id}`, {
          method: 'PATCH',
          body: patch,
        });
        this.contacts = this.contacts.map((item) =>
          item.id === id ? { ...item, ...response.contact } : item,
        );
        this.organizationContacts = this.organizationContacts.map((item) =>
          item.id === id ? { ...item, ...response.contact } : item,
        );
        return response.contact;
      } catch (error) {
        this.captureError(error, 'Failed to update contact');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async archiveContact(id: string) {
      this.clearFeedback();
      try {
        await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
        this.contacts = this.contacts.filter((item) => item.id !== id);
        this.organizationContacts = this.organizationContacts.filter((item) => item.id !== id);
      } catch (error) {
        this.captureError(error, 'Failed to archive contact');
      }
    },
    async restoreContact(id: string) {
      const contact = await this.updateContact(id, { archived: false });
      if (contact && !this.contacts.some((item) => item.id === contact.id)) {
        this.contacts.unshift(contact);
      }
      return contact;
    },
    resetFilters() {
      this.filters = emptyFilters();
    },
    mergeOrganization(organization: Organization) {
      this.organizations = this.organizations.map((item) =>
        item.id === organization.id ? organization : item,
      );
      if (this.selectedOrganization?.id === organization.id) {
        this.selectedOrganization = organization;
      }
    },
    captureError(error: unknown, fallback: string) {
      this.error = error instanceof Error ? error.message : fallback;
      if (error instanceof ApiError && isFieldErrorBody(error.body)) {
        this.fieldErrors = error.body.fields;
      }
    },
  },
});

function isFieldErrorBody(value: unknown): value is { fields: FieldErrors } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'fields' in value &&
      typeof (value as { fields?: unknown }).fields === 'object',
  );
}
