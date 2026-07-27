<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/PageHeader.vue';
import { apiFetch } from '@/lib/api';
import type { MessageTemplate } from '@/types/crm';

const templates = ref<MessageTemplate[]>([]);
const saving = ref(false);
const error = ref('');
const draft = reactive({
  template_key: '',
  title: '',
  channel: 'dm' as MessageTemplate['channel'],
  language: 'de' as MessageTemplate['language'],
  body: 'Hallo {{contact_first_name}},\n\n',
});

async function load() {
  try {
    const response = await apiFetch<{ templates: MessageTemplate[] }>('/templates');
    templates.value = response.templates;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load templates';
  }
}

async function createTemplate() {
  saving.value = true;
  error.value = '';
  try {
    const response = await apiFetch<{ template: MessageTemplate }>('/templates', {
      method: 'POST',
      body: {
        ...draft,
        template_key: draft.template_key || undefined,
      },
    });
    templates.value.push(response.template);
    templates.value.sort((left, right) =>
      `${left.template_key}-${left.language}`.localeCompare(`${right.template_key}-${right.language}`),
    );
    draft.template_key = response.template.template_key;
    draft.body = '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to create template';
  } finally {
    saving.value = false;
  }
}

async function archive(template: MessageTemplate) {
  await apiFetch(`/templates/${template.id}`, { method: 'DELETE' });
  templates.value = templates.value.filter((item) => item.id !== template.id);
}

onMounted(load);
</script>

<template>
  <section class="page">
    <PageHeader
      eyebrow="Freelance"
      title="Templates"
      description="Reusable, language-aware outreach that is always reviewed before sending."
    />
    <p v-if="error" class="form-error">{{ error }}</p>
    <form class="panel template-form" @submit.prevent="createTemplate">
      <div class="form-grid">
        <label>
          Variant group key
          <input v-model="draft.template_key" maxlength="80" placeholder="first_visit" />
        </label>
        <label>
          Title
          <input v-model="draft.title" required maxlength="160" />
        </label>
        <label>
          Channel
          <select v-model="draft.channel">
            <option value="dm">DM</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="in_person">In person</option>
          </select>
        </label>
        <label>
          Language
          <select v-model="draft.language">
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <label>
        Body
        <textarea v-model="draft.body" required maxlength="10000"></textarea>
      </label>
      <p class="form-hint">
        Variables:
        <code v-pre>{{contact_first_name}}</code>,
        <code v-pre>{{organization_name}}</code>,
        <code v-pre>{{district}}</code>,
        <code v-pre>{{finding}}</code>
      </p>
      <button type="submit" :disabled="saving">{{ saving ? 'Saving' : 'Add variant' }}</button>
    </form>
    <EmptyState
      v-if="templates.length === 0"
      title="No templates yet"
      description="Create the first language variant above."
    />
    <div v-else class="crm-card-list">
      <article v-for="template in templates" :key="template.id" class="crm-card">
        <div class="crm-card-heading">
          <div>
            <span class="eyebrow">{{ template.template_key }} · {{ template.language }}</span>
            <h2>{{ template.title }}</h2>
          </div>
          <span class="tag-chip">{{ template.channel }}</span>
        </div>
        <p class="pre-wrap">{{ template.body }}</p>
        <div class="action-row">
          <button type="button" class="text-button" @click="archive(template)">Archive</button>
        </div>
      </article>
    </div>
  </section>
</template>
