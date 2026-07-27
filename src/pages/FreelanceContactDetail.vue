<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import ActivityTimeline from '@/components/ActivityTimeline.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';
import { useCrmStore } from '@/stores/crm';
import type { Contact, ContactDraft } from '@/types/crm';

const route = useRoute();
const router = useRouter();
const crm = useCrmStore();
const id = String(route.params.id);
const contact = ref<Contact | null>(null);
const loading = ref(true);
const error = ref('');
const draft = reactive<ContactDraft>({ full_name: '' });

async function load() {
  try {
    const response = await apiFetch<{ contact: Contact }>(`/contacts/${id}`);
    contact.value = response.contact;
    Object.assign(draft, response.contact);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load contact';
  } finally {
    loading.value = false;
  }
}

async function save() {
  const updated = await crm.updateContact(id, draft);
  if (updated) contact.value = updated;
}

async function archive() {
  await crm.archiveContact(id);
  if (!crm.error) await router.push('/freelance/contacts');
}

onMounted(() => {
  void Promise.all([load(), crm.fetchOrganizations()]);
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Contact"
      :title="contact?.full_name ?? 'Contact detail'"
      :description="contact?.organization?.name ?? 'Unattached contact'"
    />
    <p v-if="error || crm.error" class="form-error">{{ error || crm.error }}</p>
    <div v-if="loading" class="panel board-loading">Loading contact...</div>
    <EmptyState
      v-else-if="!contact"
      title="Contact not found"
      description="The contact may have been archived or the link is no longer valid."
    >
      <RouterLink class="button-link empty-action" to="/freelance/contacts">Back to contacts</RouterLink>
    </EmptyState>
    <template v-else>
      <form class="panel form-section" @submit.prevent="save">
        <div class="form-grid">
          <label>
            Full name
            <input v-model="draft.full_name" required maxlength="160" />
          </label>
          <label>
            Organization
            <select v-model="draft.organization_id">
              <option :value="null">Unattached</option>
              <option v-for="organization in crm.organizations" :key="organization.id" :value="organization.id">
                {{ organization.name }}
              </option>
            </select>
          </label>
          <label>
            Role
            <input v-model="draft.role" maxlength="120" />
          </label>
          <label>
            Email
            <input v-model="draft.email" type="email" maxlength="320" />
          </label>
          <label>
            Phone
            <input v-model="draft.phone" type="tel" maxlength="80" />
          </label>
          <label>
            Language
            <select v-model="draft.language">
              <option :value="null">Use organization language</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea v-model="draft.notes" maxlength="10000"></textarea>
        </label>
        <div class="action-row">
          <button type="submit" :disabled="crm.saving">Save</button>
          <button type="button" class="text-button" @click="archive">Archive</button>
        </div>
      </form>
      <ActivityTimeline subject-type="contact" :subject-id="contact.id" />
    </template>
  </section>
</template>

