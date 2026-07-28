<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';

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

type ImportResponse = {
  dry_run: boolean;
  totals: {
    rows_parsed: number;
    organizations_created: number;
    organizations_updated: number;
    organizations_skipped: number;
    contacts_created: number;
    contacts_updated: number;
    contacts_skipped: number;
    opportunities_created: number;
  };
  rows: RowResult[];
  row_errors: RowError[];
};

const csv = ref('');
const fileName = ref('');
const previewing = ref(false);
const importing = ref(false);
const error = ref('');
const preview = ref<ImportResponse | null>(null);
const confirmed = ref<ImportResponse | null>(null);

watch(csv, () => {
  preview.value = null;
  confirmed.value = null;
});

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  csv.value = await file.text();
}

async function runPreview() {
  if (!csv.value.trim()) return;
  previewing.value = true;
  error.value = '';
  try {
    preview.value = await apiFetch<ImportResponse>('/leads/import?dry_run=true', {
      method: 'POST',
      body: { csv: csv.value },
    });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to preview import';
  } finally {
    previewing.value = false;
  }
}

async function runImport() {
  if (!preview.value) return;
  importing.value = true;
  error.value = '';
  try {
    confirmed.value = await apiFetch<ImportResponse>('/leads/import', {
      method: 'POST',
      body: { csv: csv.value },
    });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to import leads';
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Import leads"
      description="Bring a CSV of prospects into the pipeline. Preview what will change before anything is written."
    />

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <form class="panel" @submit.prevent="runPreview">
      <label>
        CSV file
        <input type="file" accept=".csv,text/csv" @change="onFileChange" />
      </label>
      <p v-if="fileName" class="form-hint">Loaded {{ fileName }}. You can also paste or edit CSV text below.</p>
      <label>
        CSV text
        <textarea v-model="csv" rows="8" placeholder="business,district,address,category,phone,owner_name,domain,..."></textarea>
      </label>
      <button type="submit" :disabled="previewing || !csv.trim()">
        {{ previewing ? 'Previewing' : 'Preview' }}
      </button>
    </form>

    <section v-if="preview" class="panel">
      <div class="section-heading">
        <div>
          <h2>Preview</h2>
          <p class="subtle">Nothing has been written yet. Confirm below to apply these changes.</p>
        </div>
      </div>
      <section class="pipeline-metrics" aria-label="Import preview totals">
        <div>
          <span>Rows parsed</span>
          <strong>{{ preview.totals.rows_parsed }}</strong>
        </div>
        <div>
          <span>Organizations create / update / skip</span>
          <strong>{{ preview.totals.organizations_created }} / {{ preview.totals.organizations_updated }} / {{ preview.totals.organizations_skipped }}</strong>
        </div>
        <div>
          <span>Contacts create / update / skip</span>
          <strong>{{ preview.totals.contacts_created }} / {{ preview.totals.contacts_updated }} / {{ preview.totals.contacts_skipped }}</strong>
        </div>
        <div>
          <span>Opportunities created</span>
          <strong>{{ preview.totals.opportunities_created }}</strong>
        </div>
      </section>

      <p v-if="preview.row_errors.length" class="form-error">
        {{ preview.row_errors.length }} row(s) could not be parsed and will be skipped.
      </p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Business</th>
              <th>Organization</th>
              <th>Matched by</th>
              <th>Contact</th>
              <th>Opportunity</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in preview.rows" :key="row.row_number">
              <td>{{ row.row_number }}</td>
              <td>{{ row.business }}</td>
              <td>{{ row.organization_action }}</td>
              <td>{{ row.organization_match }}</td>
              <td>{{ row.contact_action }}</td>
              <td>{{ row.opportunity_action }}</td>
              <td>{{ row.warnings.join('; ') }}</td>
            </tr>
            <tr v-for="rowError in preview.row_errors" :key="`error-${rowError.row_number}`">
              <td>{{ rowError.row_number }}</td>
              <td colspan="5" class="form-error">{{ rowError.error }}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" :disabled="importing" @click="runImport">
        {{ importing ? 'Importing' : 'Confirm import' }}
      </button>
    </section>

    <section v-if="confirmed" class="panel">
      <h2>Import complete</h2>
      <p class="subtle">
        {{ confirmed.totals.organizations_created }} organization(s) created,
        {{ confirmed.totals.organizations_updated }} updated,
        {{ confirmed.totals.contacts_created }} contact(s) created,
        {{ confirmed.totals.opportunities_created }} opportunit{{ confirmed.totals.opportunities_created === 1 ? 'y' : 'ies' }} created.
      </p>
      <div class="action-row">
        <RouterLink to="/freelance/organizations" class="text-button">View organizations</RouterLink>
        <RouterLink to="/freelance/contacts" class="text-button">View contacts</RouterLink>
        <RouterLink to="/freelance" class="text-button">View pipeline</RouterLink>
      </div>
    </section>
  </section>
</template>
