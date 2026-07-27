<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';

import EmptyState from '@/components/EmptyState.vue';
import EntityListShell from '@/components/EntityListShell.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useCrmStore } from '@/stores/crm';
import type { ContactDraft } from '@/types/crm';

const crm = useCrmStore();
const showArchived = ref(false);
const draft = reactive<ContactDraft>({
  full_name: '',
  organization_id: null,
  role: '',
  email: '',
  language: null,
  is_primary: false,
});

async function addContact() {
  const contact = await crm.createContact(draft);
  if (!contact) return;
  draft.full_name = '';
  draft.organization_id = null;
  draft.role = '';
  draft.email = '';
  draft.language = null;
  draft.is_primary = false;
}

function reloadContacts() {
  void crm.fetchContacts(undefined, showArchived.value);
}

onMounted(() => {
  void Promise.all([crm.fetchContacts(), crm.fetchOrganizations()]);
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Contacts"
      description="People connected to prospects and clients, with an explicit outreach language."
    />

    <p v-if="crm.error" class="form-error">{{ crm.error }}</p>
    <form class="panel crm-quick-add contact-quick-add" @submit.prevent="addContact">
      <div>
        <h2>Add contact</h2>
        <p class="subtle">A contact may remain unattached until you know their organization.</p>
      </div>
      <label>
        Full name
        <input v-model="draft.full_name" required maxlength="160" />
        <span v-if="crm.fieldErrors.full_name" class="field-error">{{ crm.fieldErrors.full_name }}</span>
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
        Language
        <select v-model="draft.language">
          <option :value="null">Use organization language</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="en">English</option>
        </select>
      </label>
      <button type="submit" :disabled="crm.saving">{{ crm.saving ? 'Saving' : 'Add contact' }}</button>
    </form>

    <EntityListShell>
      <template #toolbar>
        <label class="check-field panel compact-control">
          <input v-model="showArchived" type="checkbox" @change="reloadContacts" />
          Archived contacts
        </label>
      </template>
      <div v-if="crm.loading" class="panel board-loading">Loading contacts...</div>
      <EmptyState
        v-else-if="crm.contacts.length === 0"
        title="No contacts yet"
        description="Add a person above or from an organization detail page."
      />
      <div v-else class="crm-card-list">
        <article v-for="contact in crm.contacts" :key="contact.id" class="crm-card">
          <div class="crm-card-heading">
            <div>
              <span class="eyebrow">{{ contact.language ?? 'Inherited language' }}</span>
              <h2>{{ contact.full_name }}</h2>
            </div>
            <span v-if="contact.is_primary" class="tag-chip">Primary</span>
          </div>
          <p class="subtle">
            {{ contact.role || 'Role not added' }}
            <template v-if="contact.organization"> · {{ contact.organization.name }}</template>
          </p>
          <div class="action-row">
            <RouterLink
              v-if="contact.organization_id"
              class="button-link"
              :to="`/freelance/organizations/${contact.organization_id}`"
            >
              Organization
            </RouterLink>
            <a v-if="contact.email" class="text-button" :href="`mailto:${contact.email}`">Email</a>
            <button
              v-if="contact.archived_at"
              type="button"
              class="text-button"
              @click="crm.restoreContact(contact.id)"
            >
              Restore
            </button>
            <button v-else type="button" class="text-button" @click="crm.archiveContact(contact.id)">Archive</button>
          </div>
        </article>
      </div>
    </EntityListShell>
  </section>
</template>
