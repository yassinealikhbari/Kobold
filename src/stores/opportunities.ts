import { defineStore } from 'pinia';

import { ApiError, apiFetch } from '@/lib/api';
import type {
  Opportunity,
  OpportunityDraft,
  OpportunityLostReason,
  OpportunityStage,
} from '@/types/crm';

type FieldErrors = Record<string, string>;

export const useOpportunitiesStore = defineStore('opportunities', {
  state: () => ({
    opportunities: [] as Opportunity[],
    archived: [] as Opportunity[],
    selected: null as Opportunity | null,
    loading: false,
    saving: false,
    error: null as string | null,
    fieldErrors: {} as FieldErrors,
  }),
  actions: {
    clearFeedback() {
      this.error = null;
      this.fieldErrors = {};
    },
    async fetchOpportunities() {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiFetch<{ opportunities: Opportunity[] }>('/opportunities');
        this.opportunities = response.opportunities;
      } catch (error) {
        this.captureError(error, 'Failed to load opportunities');
      } finally {
        this.loading = false;
      }
    },
    async fetchOpportunity(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiFetch<{ opportunity: Opportunity }>(`/opportunities/${id}`);
        this.selected = response.opportunity;
      } catch (error) {
        this.captureError(error, 'Failed to load opportunity');
      } finally {
        this.loading = false;
      }
    },
    async createOpportunity(draft: OpportunityDraft): Promise<Opportunity | null> {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{ opportunity: Opportunity }>('/opportunities', {
          method: 'POST',
          body: draft,
        });
        this.opportunities.unshift(response.opportunity);
        return response.opportunity;
      } catch (error) {
        this.captureError(error, 'Failed to create opportunity');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async updateOpportunity(
      id: string,
      patch: Partial<OpportunityDraft> & { archived?: false },
    ): Promise<Opportunity | null> {
      this.saving = true;
      this.clearFeedback();
      try {
        const response = await apiFetch<{ opportunity: Opportunity }>(`/opportunities/${id}`, {
          method: 'PATCH',
          body: patch,
        });
        this.mergeOpportunity(response.opportunity);
        return response.opportunity;
      } catch (error) {
        this.captureError(error, 'Failed to update opportunity');
        return null;
      } finally {
        this.saving = false;
      }
    },
    async moveOpportunity(
      id: string,
      stage: OpportunityStage,
      lostReason?: OpportunityLostReason | null,
    ): Promise<boolean> {
      const opportunity = this.opportunities.find((item) => item.id === id);
      if (!opportunity || opportunity.stage === stage) return true;
      const previous = { ...opportunity };
      const timestamp = new Date().toISOString();
      Object.assign(opportunity, {
        stage,
        lost_reason: stage === 'lost' ? (lostReason ?? null) : null,
        stage_changed_at: timestamp,
        updated_at: timestamp,
      });

      try {
        const response = await apiFetch<{ opportunity: Opportunity }>(`/opportunities/${id}`, {
          method: 'PATCH',
          body: { stage, lost_reason: stage === 'lost' ? lostReason : null },
        });
        this.mergeOpportunity(response.opportunity);
        return true;
      } catch (error) {
        Object.assign(opportunity, previous);
        this.captureError(error, 'Stage change failed and was rolled back');
        return false;
      }
    },
    async archiveOpportunity(id: string) {
      this.clearFeedback();
      try {
        const response = await apiFetch<{ opportunity: Opportunity }>(`/opportunities/${id}`, {
          method: 'DELETE',
        });
        this.opportunities = this.opportunities.filter((item) => item.id !== id);
        if (this.selected?.id === id) this.selected = response.opportunity;
      } catch (error) {
        this.captureError(error, 'Failed to archive opportunity');
      }
    },
    async fetchArchivedOpportunities() {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiFetch<{ opportunities: Opportunity[] }>('/opportunities?archived=true');
        this.archived = response.opportunities;
      } catch (error) {
        this.captureError(error, 'Failed to load archived opportunities');
      } finally {
        this.loading = false;
      }
    },
    async restoreOpportunity(id: string): Promise<Opportunity | null> {
      this.clearFeedback();
      try {
        const response = await apiFetch<{ opportunity: Opportunity }>(`/opportunities/${id}`, {
          method: 'PATCH',
          body: { archived: false, stage: 'lead' },
        });
        this.archived = this.archived.filter((item) => item.id !== id);
        if (this.selected?.id === id) this.selected = response.opportunity;
        return response.opportunity;
      } catch (error) {
        this.captureError(error, 'Failed to restore opportunity');
        return null;
      }
    },
    mergeOpportunity(opportunity: Opportunity) {
      this.opportunities = this.opportunities.map((item) =>
        item.id === opportunity.id ? opportunity : item,
      );
      if (this.selected?.id === opportunity.id) this.selected = opportunity;
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

