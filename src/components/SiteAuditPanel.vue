<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { apiFetch } from '@/lib/api';
import { absoluteDate } from '@/lib/dates';
import type { SiteAudit } from '@/types/crm';

const props = defineProps<{
  organizationId: string;
  website: string | null;
}>();

const audits = ref<SiteAudit[]>([]);
const loading = ref(false);
const error = ref('');
const latest = computed(() => audits.value[0] ?? null);
const findings = computed(() => {
  if (!latest.value || latest.value.status === 'failed') return [];
  return [
    { label: 'HTTPS', pass: latest.value.https === true },
    { label: 'Mobile viewport', pass: latest.value.viewport_meta === true },
    { label: 'Readable encoding', pass: latest.value.mojibake_detected === false },
    { label: 'Impressum link', pass: latest.value.has_impressum === true },
    { label: 'Datenschutz link', pass: latest.value.has_datenschutz === true },
    { label: 'Open Graph tags', pass: latest.value.has_open_graph === true },
  ];
});

async function load() {
  try {
    const response = await apiFetch<{ audits: SiteAudit[] }>(
      `/audit?organization_id=${props.organizationId}`,
    );
    audits.value = response.audits;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load audits';
  }
}

async function runAudit() {
  if (!props.website) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiFetch<{ audit: SiteAudit }>('/audit', {
      method: 'POST',
      body: { url: props.website, organization_id: props.organizationId },
    });
    audits.value.unshift(response.audit);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Audit failed';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="panel audit-panel">
    <div class="section-heading">
      <div>
        <h2>Site audit</h2>
        <p class="subtle">A stored technical snapshot—never the page HTML.</p>
      </div>
      <button type="button" :disabled="loading || !website" @click="runAudit">
        {{ loading ? 'Auditing' : latest ? 'Run again' : 'Run audit' }}
      </button>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="!website" class="form-hint">Add a website to run an audit.</p>
    <p v-else-if="!latest" class="subtle">No audit history yet.</p>
    <template v-else>
      <div class="audit-summary">
        <div>
          <span>Status</span>
          <strong>{{ latest.status }}</strong>
        </div>
        <div>
          <span>HTTP</span>
          <strong>{{ latest.http_status ?? '—' }}</strong>
        </div>
        <div>
          <span>Response</span>
          <strong>{{ latest.response_ms !== null ? `${latest.response_ms} ms` : '—' }}</strong>
        </div>
        <div>
          <span>Page weight</span>
          <strong>{{ latest.page_weight_bytes !== null ? `${Math.round(latest.page_weight_bytes / 1024)} KB` : '—' }}</strong>
        </div>
      </div>
      <p v-if="latest.error" class="form-error">{{ latest.error }}</p>
      <ul v-else class="audit-checklist">
        <li v-for="finding in findings" :key="finding.label" :class="{ 'is-failed': !finding.pass }">
          <strong>{{ finding.pass ? 'Pass' : 'Needs work' }}</strong>
          <span>{{ finding.label }}</span>
        </li>
      </ul>
      <dl class="metadata-list">
        <div>
          <dt>CMS</dt>
          <dd>{{ latest.cms ?? 'Unknown' }}</dd>
        </div>
        <div>
          <dt>Charset</dt>
          <dd>{{ latest.charset ?? 'Not declared' }}</dd>
        </div>
      </dl>
      <p class="subtle">Audited {{ absoluteDate(latest.audited_at) }} · {{ audits.length }} stored snapshot{{ audits.length === 1 ? '' : 's' }}</p>
    </template>
  </section>
</template>

