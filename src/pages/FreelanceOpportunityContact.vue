<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';
import { buildMailtoUrl } from '@/lib/mailto';
import { useCrmStore } from '@/stores/crm';
import { useOpportunitiesStore } from '@/stores/opportunities';

const route = useRoute();
const crm = useCrmStore();
const pipeline = useOpportunitiesStore();
const id = String(route.params.id);

const to = ref('');
const subject = ref('');
const body = ref('');
const loaded = ref(false);
const sending = ref(false);
const feedback = ref('');
const error = ref('');
const advanceStage = ref(true);

const mailtoHref = computed(() => buildMailtoUrl(to.value, subject.value, body.value));
const canSend = computed(() => loaded.value && to.value.trim().length > 0);

onMounted(async () => {
  await pipeline.fetchOpportunity(id);
  const opportunity = pipeline.selected;
  if (!opportunity) return;
  subject.value = opportunity.draft_email_subject ?? '';
  body.value = opportunity.draft_email_body ?? '';
  if (opportunity.organization_id) {
    await crm.fetchOrganization(opportunity.organization_id);
    const withEmail = crm.organizationContacts.filter((contact) => contact.email);
    const primary = withEmail.find((contact) => contact.is_primary) ?? withEmail[0];
    to.value = primary?.email ?? '';
  }
  loaded.value = true;
});

async function send() {
  if (!canSend.value) return;
  sending.value = true;
  error.value = '';
  feedback.value = '';
  try {
    window.location.href = mailtoHref.value;
    await pipeline.updateOpportunity(id, {
      draft_email_subject: subject.value,
      draft_email_body: body.value,
      ...(advanceStage.value && pipeline.selected?.stage === 'lead' ? { stage: 'contacted' } : {}),
    });
    await apiFetch('/activities', {
      method: 'POST',
      body: {
        subject_type: 'opportunity',
        subject_id: id,
        kind: 'email',
        body: `Sent email to ${to.value}: ${subject.value}\n\n${body.value}`,
      },
    });
    feedback.value = 'Opened your mail app with this message and logged it.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not log the send.';
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Outreach"
      :title="pipeline.selected?.title ?? 'Compose email'"
      :description="pipeline.selected ? `${pipeline.selected.organization?.name ?? 'Unknown organization'} · edit the drafted email, then send it from your own mail app` : undefined"
    />

    <p v-if="pipeline.error" class="form-error">{{ pipeline.error }}</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="feedback" class="form-hint" role="status">{{ feedback }}</p>
    <div v-if="pipeline.loading" class="panel board-loading">Loading opportunity...</div>
    <EmptyState
      v-else-if="!pipeline.selected"
      title="Opportunity not found"
      description="The opportunity may have been archived or the link is no longer valid."
    >
      <RouterLink class="button-link empty-action" to="/freelance">Back to pipeline</RouterLink>
    </EmptyState>

    <form v-else class="panel form-section" @submit.prevent>
      <label>
        To
        <input v-model="to" type="email" placeholder="owner@example.de" required />
      </label>
      <label>
        Subject
        <input v-model="subject" maxlength="300" />
      </label>
      <label>
        Body
        <textarea v-model="body" rows="12"></textarea>
      </label>
      <label class="check-field">
        <input v-model="advanceStage" type="checkbox" />
        Move this opportunity to "Contacted" when sent
      </label>
      <div class="action-row">
        <button type="button" :disabled="!canSend || sending" @click="send">
          {{ sending ? 'Working' : 'Send' }}
        </button>
        <RouterLink
          v-if="pipeline.selected.organization_id"
          class="text-button"
          :to="`/freelance/organizations/${pipeline.selected.organization_id}`"
        >
          Back to organization
        </RouterLink>
      </div>
    </form>
  </section>
</template>
