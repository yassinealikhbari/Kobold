<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { apiFetch } from '@/lib/api';
import { chooseTemplateVariant, renderTemplate } from '@/lib/templates';
import type { Contact, MessageTemplate } from '@/types/crm';

const props = defineProps<{ contact: Contact }>();

const templates = ref<MessageTemplate[]>([]);
const selectedKey = ref('');
const selectedTemplate = ref<MessageTemplate | null>(null);
const finding = ref('');
const rendered = ref('');
const createFollowUp = ref(true);
const feedback = ref('');
const error = ref('');
const saving = ref(false);

const templateKeys = computed(() =>
  [...new Map(templates.value.map((item) => [item.template_key, item.title])).entries()],
);

watch(
  [selectedKey, templates],
  () => {
    selectedTemplate.value = chooseTemplateVariant(
      templates.value,
      selectedKey.value,
      props.contact.language,
      props.contact.organization?.language ?? null,
    );
    render();
  },
  { deep: true },
);
watch(finding, render);

function render() {
  if (!selectedTemplate.value) {
    rendered.value = '';
    return;
  }
  rendered.value = renderTemplate(selectedTemplate.value.body, {
    contact_first_name: props.contact.full_name.split(/\s+/)[0] ?? null,
    organization_name: props.contact.organization?.name ?? null,
    district: props.contact.organization?.district ?? null,
    finding: finding.value,
  });
}

async function load() {
  try {
    const response = await apiFetch<{ templates: MessageTemplate[] }>('/templates');
    templates.value = response.templates;
    selectedKey.value = templateKeys.value[0]?.[0] ?? '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load templates';
  }
}

async function copyAndLog() {
  if (!selectedTemplate.value || !rendered.value) return;
  saving.value = true;
  error.value = '';
  feedback.value = '';
  try {
    await navigator.clipboard.writeText(rendered.value);
    const activityKind =
      selectedTemplate.value.channel === 'email'
        ? 'email'
        : selectedTemplate.value.channel === 'in_person'
          ? 'meeting'
          : 'dm';
    await apiFetch('/activities', {
      method: 'POST',
      body: {
        subject_type: 'contact',
        subject_id: props.contact.id,
        kind: activityKind,
        body: `Sent ${selectedTemplate.value.channel} using “${selectedTemplate.value.title}”.\n\n${rendered.value}`,
      },
    });
    if (createFollowUp.value) {
      const due = new Date();
      due.setDate(due.getDate() + 3);
      due.setHours(9, 0, 0, 0);
      await apiFetch('/tasks', {
        method: 'POST',
        body: {
          subject_type: 'contact',
          subject_id: props.contact.id,
          title: `Follow up with ${props.contact.full_name}`,
          due_at: due.toISOString(),
        },
      });
    }
    feedback.value = createFollowUp.value
      ? 'Copied, logged, and follow-up created.'
      : 'Copied and logged.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not copy and log message';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="panel outreach-composer">
    <div class="section-heading">
      <div>
        <h2>Compose outreach</h2>
        <p class="subtle">KOBOLD prepares and logs the message; you send it yourself.</p>
      </div>
      <span v-if="selectedTemplate" class="tag-chip">{{ selectedTemplate.language }} · {{ selectedTemplate.channel }}</span>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="feedback" class="form-hint" role="status">{{ feedback }}</p>
    <p v-if="templates.length === 0" class="form-hint">
      Create an outreach template from the Templates page first.
    </p>
    <template v-else>
      <div class="form-grid">
        <label>
          Template
          <select v-model="selectedKey">
            <option v-for="[key, title] in templateKeys" :key="key" :value="key">{{ title }}</option>
          </select>
        </label>
        <label>
          Site finding
          <input v-model="finding" placeholder="The mobile layout is difficult to use" />
        </label>
      </div>
      <label>
        Review message
        <textarea v-model="rendered" rows="9"></textarea>
      </label>
      <label class="check-field">
        <input v-model="createFollowUp" type="checkbox" />
        Create a follow-up in three days
      </label>
      <button type="button" :disabled="saving || !rendered" @click="copyAndLog">
        {{ saving ? 'Working' : 'Copy and log sent' }}
      </button>
    </template>
  </section>
</template>

