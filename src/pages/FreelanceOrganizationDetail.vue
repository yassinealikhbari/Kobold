<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import ActivityTimeline from '@/components/ActivityTimeline.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntityDetailShell from '@/components/EntityDetailShell.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useCrmStore } from '@/stores/crm';
import type { ContactDraft, OrganizationDraft } from '@/types/crm';

const route = useRoute();
const router = useRouter();
const crm = useCrmStore();
const id = String(route.params.id);
const draft = reactive<OrganizationDraft>({
  name: '',
  website: '',
  industry: '',
  district: '',
  postcode: '',
  country: 'DE',
  language: 'de',
  origin: 'manual',
  status: 'prospect',
  notes: '',
});
const contactDraft = reactive<ContactDraft>({
  full_name: '',
  organization_id: id,
  role: '',
  email: '',
  phone: '',
  language: null,
  is_primary: false,
});

watch(
  () => crm.selectedOrganization,
  (organization) => {
    if (!organization) return;
    Object.assign(draft, organization);
  },
  { immediate: true },
);

async function saveOrganization() {
  await crm.updateOrganization(id, draft);
}

async function addContact() {
  const contact = await crm.createContact(contactDraft);
  if (!contact) return;
  contactDraft.full_name = '';
  contactDraft.role = '';
  contactDraft.email = '';
  contactDraft.phone = '';
  contactDraft.language = null;
  contactDraft.is_primary = false;
}

async function archiveOrganization() {
  await crm.archiveOrganization(id);
  if (!crm.error) await router.push('/freelance/organizations');
}

async function restoreOrganization() {
  await crm.restoreOrganization(id);
}

onMounted(() => {
  void crm.fetchOrganization(id);
});
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Organization"
      :title="crm.selectedOrganization?.name ?? 'Organization detail'"
      description="Contacts and prospect context stay together."
    />

    <p v-if="crm.error" class="form-error">{{ crm.error }}</p>
    <div v-if="crm.loading" class="panel board-loading">Loading organization...</div>
    <EmptyState
      v-else-if="!crm.selectedOrganization"
      title="Organization not found"
      description="The organization may have been archived or the link is no longer valid."
    >
      <RouterLink class="button-link empty-action" to="/freelance/organizations">
        Back to organizations
      </RouterLink>
    </EmptyState>

    <EntityDetailShell v-else>
      <form class="panel form-section" @submit.prevent="saveOrganization">
        <div class="section-heading">
          <h2>Organization</h2>
          <span class="tag-chip">{{ crm.selectedOrganization.status }}</span>
        </div>
        <div class="form-grid">
          <label>
            Name
            <input v-model="draft.name" required maxlength="160" />
            <span v-if="crm.fieldErrors.name" class="field-error">{{ crm.fieldErrors.name }}</span>
          </label>
          <label>
            Website
            <input v-model="draft.website" type="url" maxlength="2048" placeholder="https://" />
            <span v-if="crm.fieldErrors.website" class="field-error">{{ crm.fieldErrors.website }}</span>
          </label>
          <label>
            Industry
            <input v-model="draft.industry" maxlength="120" />
          </label>
          <label>
            District
            <input v-model="draft.district" maxlength="120" />
          </label>
          <label>
            Postcode
            <input v-model="draft.postcode" maxlength="12" />
            <span v-if="crm.fieldErrors.postcode" class="field-error">{{ crm.fieldErrors.postcode }}</span>
          </label>
          <label>
            Country
            <input v-model="draft.country" maxlength="2" />
          </label>
          <label>
            Language
            <select v-model="draft.language">
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Status
            <select v-model="draft.status">
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="closed">Closed</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </label>
          <label>
            Origin
            <select v-model="draft.origin">
              <option value="manual">Manual</option>
              <option value="walk_by">Walk-by</option>
              <option value="referral">Referral</option>
              <option value="inbound">Inbound</option>
              <option value="event">Event</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea v-model="draft.notes" maxlength="10000"></textarea>
        </label>
        <div class="action-row">
          <button type="submit" :disabled="crm.saving">{{ crm.saving ? 'Saving' : 'Save' }}</button>
          <button
            v-if="crm.selectedOrganization.archived_at"
            type="button"
            class="text-button"
            @click="restoreOrganization"
          >
            Restore
          </button>
          <button v-else type="button" class="text-button" @click="archiveOrganization">Archive</button>
        </div>
      </form>

      <template #aside>
        <section class="panel form-section">
          <h2>Contacts</h2>
          <form class="contact-inline-form" @submit.prevent="addContact">
            <label>
              Full name
              <input v-model="contactDraft.full_name" required maxlength="160" />
              <span v-if="crm.fieldErrors.full_name" class="field-error">{{ crm.fieldErrors.full_name }}</span>
            </label>
            <label>
              Role
              <input v-model="contactDraft.role" maxlength="120" />
            </label>
            <label>
              Email
              <input v-model="contactDraft.email" type="email" maxlength="320" />
            </label>
            <label>
              Phone
              <input v-model="contactDraft.phone" type="tel" maxlength="80" />
            </label>
            <label>
              Preferred language
              <select v-model="contactDraft.language">
                <option :value="null">Use organization language</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="en">English</option>
              </select>
            </label>
            <label class="check-field">
              <input v-model="contactDraft.is_primary" type="checkbox" />
              Primary contact
            </label>
            <button type="submit" :disabled="crm.saving">Add contact</button>
          </form>

          <div v-if="crm.organizationContacts.length" class="contact-list">
            <article v-for="contact in crm.organizationContacts" :key="contact.id" class="contact-row">
              <div>
                <strong>{{ contact.full_name }}</strong>
                <span>{{ contact.role || 'Role not added' }}</span>
              </div>
              <span v-if="contact.is_primary" class="tag-chip">Primary</span>
              <button type="button" class="text-button" @click="crm.archiveContact(contact.id)">
                Archive
              </button>
            </article>
          </div>
          <p v-else class="subtle">No contacts yet.</p>
        </section>

        <section class="panel form-section">
          <h2>Opportunities</h2>
          <div v-if="crm.organizationOpportunities.length" class="contact-list">
            <RouterLink
              v-for="opportunity in crm.organizationOpportunities"
              :key="opportunity.id"
              class="contact-row"
              :to="`/freelance/opportunities/${opportunity.id}`"
            >
              <div>
                <strong>{{ opportunity.title }}</strong>
                <span>{{ opportunity.stage }}</span>
              </div>
              <span class="tag-chip">{{ opportunity.confidence ?? 0 }}%</span>
            </RouterLink>
          </div>
          <p v-else class="subtle">No opportunities yet.</p>
          <RouterLink class="button-link" to="/freelance">Open pipeline</RouterLink>
        </section>
      </template>
    </EntityDetailShell>
    <ActivityTimeline
      v-if="crm.selectedOrganization"
      subject-type="organization"
      :subject-id="crm.selectedOrganization.id"
    />
  </section>
</template>
