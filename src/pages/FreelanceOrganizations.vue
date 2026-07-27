<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';
import { useCrmStore } from '@/stores/crm';
import type { OrganizationDraft } from '@/types/crm';

const crm = useCrmStore();
const router = useRouter();
const quickAdd = reactive<OrganizationDraft>({ name: '', website: '' });
const leadUrl = ref('');
const capturingLead = ref(false);

async function createOrganization() {
  const organization = await crm.createOrganization(quickAdd);
  if (!organization) return;
  quickAdd.name = '';
  quickAdd.website = '';
}

async function captureUrlLead() {
  capturingLead.value = true;
  crm.clearFeedback();
  try {
    const url = new URL(leadUrl.value);
    const hostname = url.hostname.replace(/^www\./i, '');
    const name = hostname
      .split('.')[0]!
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const organization = await crm.createOrganization({ name, website: url.toString() });
    if (!organization) return;
    await apiFetch('/audit', {
      method: 'POST',
      body: { url: organization.website, organization_id: organization.id },
    });
    await router.push(`/freelance/organizations/${organization.id}`);
  } catch (cause) {
    crm.error = cause instanceof Error ? cause.message : 'Failed to capture URL lead';
  } finally {
    capturingLead.value = false;
  }
}

function applyFilters() {
  void crm.fetchOrganizations();
}

function clearFilters() {
  crm.resetFilters();
  void crm.fetchOrganizations();
}

onMounted(() => {
  void crm.fetchOrganizations();
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Organizations"
      description="Businesses, prospects, and clients in one searchable workspace."
    />

    <p v-if="crm.error" class="form-error">{{ crm.error }}</p>
    <p v-if="crm.warning" class="form-hint" role="status">{{ crm.warning }}</p>

    <form class="panel crm-quick-add" @submit.prevent="createOrganization">
      <div>
        <h2>Quick add</h2>
        <p class="subtle">A name is enough. Add the details when you know them.</p>
      </div>
      <label>
        Name
        <input v-model="quickAdd.name" required maxlength="160" />
        <span v-if="crm.fieldErrors.name" class="field-error">{{ crm.fieldErrors.name }}</span>
      </label>
      <label>
        Website
        <input v-model="quickAdd.website" type="url" placeholder="https://" maxlength="2048" />
        <span v-if="crm.fieldErrors.website" class="field-error">{{ crm.fieldErrors.website }}</span>
      </label>
      <button type="submit" :disabled="crm.saving">
        {{ crm.saving ? 'Saving' : 'Add organization' }}
      </button>
    </form>

    <form class="panel url-lead-form" @submit.prevent="captureUrlLead">
      <div>
        <h2>Capture from URL</h2>
        <p class="subtle">Create the prospect, store one audit, and open its detail page.</p>
      </div>
      <label>
        Website URL
        <input v-model="leadUrl" type="url" required placeholder="https://example.com" />
      </label>
      <button type="submit" :disabled="capturingLead">
        {{ capturingLead ? 'Capturing' : 'Create and audit' }}
      </button>
    </form>

    <EntityListShell>
      <template #toolbar>
        <form class="crm-filters" aria-label="Organization filters" @submit.prevent="applyFilters">
          <label>
            Search
            <input v-model="crm.filters.q" type="search" placeholder="Organization name" />
          </label>
          <label>
            Status
            <select v-model="crm.filters.status">
              <option value="">All statuses</option>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="closed">Closed</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </label>
          <label>
            Language
            <select v-model="crm.filters.language">
              <option value="">All languages</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Website
            <select v-model="crm.filters.has_website">
              <option value="">Any</option>
              <option value="true">Has website</option>
              <option value="false">No website</option>
            </select>
          </label>
          <label class="check-field">
            <input v-model="crm.filters.archived" type="checkbox" />
            Archived only
          </label>
          <div class="action-row">
            <button type="submit">Apply</button>
            <button type="button" class="text-button" @click="clearFilters">Clear</button>
          </div>
        </form>
      </template>

      <div v-if="crm.loading" class="panel board-loading">Loading organizations...</div>
      <EmptyState
        v-else-if="crm.organizations.length === 0"
        title="No organizations found"
        description="Add a prospect above or clear the active filters."
      />
      <div v-else class="crm-card-list">
        <article v-for="organization in crm.organizations" :key="organization.id" class="crm-card">
          <div class="crm-card-heading">
            <div>
              <span class="eyebrow">{{ organization.status }} · {{ organization.language }}</span>
              <h2>{{ organization.name }}</h2>
            </div>
            <span class="tag-chip">{{ organization.origin.replace('_', ' ') }}</span>
          </div>
          <p class="subtle">
            {{ [organization.industry, organization.district, organization.postcode].filter(Boolean).join(' · ') || 'Details not added yet' }}
          </p>
          <div class="action-row">
            <RouterLink class="button-link" :to="`/freelance/organizations/${organization.id}`">
              Open
            </RouterLink>
            <a v-if="organization.website" class="text-button" :href="organization.website" target="_blank" rel="noreferrer">
              Website
            </a>
            <button
              v-if="organization.archived_at"
              type="button"
              class="text-button"
              @click="crm.restoreOrganization(organization.id)"
            >
              Restore
            </button>
            <button
              v-else
              type="button"
              class="text-button"
              @click="crm.archiveOrganization(organization.id)"
            >
              Archive
            </button>
          </div>
        </article>
      </div>
    </EntityListShell>
  </section>
</template>
