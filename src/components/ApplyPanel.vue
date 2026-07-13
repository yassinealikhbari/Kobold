<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { apiFetch } from '@/lib/api';
import { useProfileStore } from '@/stores/profile';
import type { Application } from '@/types/applications';
import type { Job } from '@/types/jobs';

const props = defineProps<{
  job: Job;
  applicationOpened: boolean;
}>();

const emit = defineEmits<{
  applicationChange: [];
}>();

const profile = useProfileStore();
const application = ref<Application | null>(null);
const letter = ref('');
const instructions = ref('');
const generating = ref(false);
const savingLetter = ref(false);
const saving = ref(false);
const error = ref('');
const markingApplied = ref(false);
let saveTimer: number | undefined;

const copyFields = computed(() => [
  { label: 'Name', value: profile.profile.full_name },
  { label: 'Email', value: profile.profile.email },
  { label: 'Phone', value: profile.profile.phone },
  { label: 'LinkedIn', value: profile.profile.linkedin },
  { label: 'GitHub', value: profile.profile.github },
  { label: 'Portfolio', value: profile.profile.portfolio },
  { label: 'Location', value: profile.profile.location },
].filter((field) => Boolean(field.value)));

const missingProfileItems = computed(() => {
  const missing: string[] = [];
  if (!profile.profile.summary) missing.push('summary');
  if (!profile.profile.cv_path) missing.push('CV');
  return missing;
});

const profileReady = computed(() => missingProfileItems.value.length === 0);

async function copy(value: string | null) {
  await navigator.clipboard.writeText(value ?? '');
}

async function ensureApplication() {
  if (application.value) return application.value;
  const response = await apiFetch<{ application: Application }>('/applications', {
    method: 'POST',
    body: { job_id: props.job.id },
  });
  application.value = response.application;
  letter.value = response.application.cover_letter ?? '';
  return response.application;
}

async function fetchApplication() {
  const response = await apiFetch<{ application: Application | null }>(`/applications?job_id=${encodeURIComponent(props.job.id)}`);
  application.value = response.application;
  letter.value = response.application?.cover_letter ?? '';
}

async function saveForLater() {
  saving.value = true;
  error.value = '';

  try {
    await ensureApplication();
    emit('applicationChange');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to save job';
  } finally {
    saving.value = false;
  }
}

async function generateLetter() {
  generating.value = true;
  error.value = '';

  try {
    const response = await apiFetch<{ letter: string; application: Application }>('/cover-letter', {
      method: 'POST',
      body: { job_id: props.job.id, instructions: instructions.value },
    });
    application.value = response.application;
    letter.value = response.letter;
    emit('applicationChange');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Cover letter generation failed';
  } finally {
    generating.value = false;
  }
}

async function persistLetter() {
  const current = await ensureApplication();
  savingLetter.value = true;

  try {
    const response = await apiFetch<{ application: Application }>(`/applications/${current.id}`, {
      method: 'PATCH',
      body: { cover_letter: letter.value },
    });
    application.value = response.application;
  } finally {
    savingLetter.value = false;
  }
}

async function downloadCv() {
  const url = await profile.fetchCvUrl();
  window.open(url, '_blank', 'noreferrer');
}

async function markApplied() {
  markingApplied.value = true;
  error.value = '';

  try {
    const current = await ensureApplication();
    const response = await apiFetch<{ application: Application }>(`/applications/${current.id}`, {
      method: 'PATCH',
      body: { status: 'applied', cover_letter: letter.value },
    });
    application.value = response.application;
    emit('applicationChange');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to update application';
  } finally {
    markingApplied.value = false;
  }
}

watch(letter, () => {
  window.clearTimeout(saveTimer);
  if (!application.value) return;
  saveTimer = window.setTimeout(() => {
    void persistLetter();
  }, 600);
});

onMounted(async () => {
  await profile.fetchProfile();
  await fetchApplication();
});

defineExpose({ saveForLater });
</script>

<template>
  <section class="panel apply-panel">
    <div>
      <p class="eyebrow">Application prep</p>
      <h2>Before you apply</h2>
    </div>

    <div class="prep-checklist">
      <div>
        <span>Profile summary</span>
        <strong :class="{ 'is-ready': profile.profile.summary }">{{ profile.profile.summary ? 'Ready' : 'Missing' }}</strong>
      </div>
      <div>
        <span>CV</span>
        <strong :class="{ 'is-ready': profile.profile.cv_path }">{{ profile.profile.cv_path ? 'Ready' : 'Missing' }}</strong>
      </div>
    </div>

    <p v-if="!profileReady" class="form-hint">
      Complete your {{ missingProfileItems.join(' and ') }} before applying.
      <RouterLink to="/profile">Complete profile</RouterLink>
    </p>

    <div v-if="application?.status === 'applied'" class="application-state">
      <strong>Application tracked</strong>
      <span>This role is now in your Tracker.</span>
    </div>
    <div v-else-if="applicationOpened" class="application-state">
      <strong>Application form opened</strong>
      <span>Come back after submitting to keep your Tracker accurate.</span>
      <div class="action-row">
        <button
          type="button"
          class="job-action job-action--primary"
          :disabled="markingApplied"
          @click="markApplied"
        >
          {{ markingApplied ? 'Updating' : 'I applied' }}
        </button>
        <button type="button" class="job-action" :disabled="saving" @click="saveForLater">
          {{ saving ? 'Saving' : 'Save for later' }}
        </button>
      </div>
    </div>
    <div v-else-if="application" class="application-state">
      <strong>Saved to Tracker</strong>
      <span>This role is saved for later and ready when you are.</span>
    </div>
    <p v-else class="subtle">Open the application form when you are ready. KOBOLD will then help you track the outcome.</p>

    <details class="prep-disclosure">
      <summary>Application details</summary>
      <div v-if="copyFields.length" class="copy-grid">
        <div v-for="field in copyFields" :key="field.label" class="copy-field">
          <span>
            <strong>{{ field.label }}</strong>
            <small>{{ field.value }}</small>
          </span>
          <button type="button" @click="copy(field.value)">Copy</button>
        </div>
      </div>
      <p v-else class="subtle">Add contact details in your profile to use quick copy.</p>
    </details>

    <details class="prep-disclosure">
      <summary>Cover letter <span>Optional</span></summary>
      <div class="cover-letter-block">
        <p v-if="!profile.profile.summary" class="form-hint">Add your profile summary before generating a letter.</p>
        <div class="section-heading">
          <h3>Draft</h3>
          <button type="button" :disabled="generating || !profile.profile.summary" @click="generateLetter">
            {{ letter ? 'Regenerate' : generating ? 'Generating' : 'Generate' }}
          </button>
        </div>
        <input v-model="instructions" type="text" placeholder="Optional instructions" />
        <textarea v-model="letter" rows="10" placeholder="Your draft appears here"></textarea>
        <div class="action-row">
          <button type="button" :disabled="!letter" @click="copy(letter)">Copy letter</button>
          <span v-if="savingLetter" class="subtle">Saving...</span>
        </div>
      </div>
    </details>

    <details v-if="profile.profile.cv_path" class="prep-disclosure">
      <summary>CV</summary>
      <div class="action-row">
        <span class="subtle">{{ profile.profile.cv_path }}</span>
        <button type="button" @click="downloadCv">Download CV</button>
      </div>
    </details>

    <p v-if="error" class="form-error">{{ error }}</p>
  </section>
</template>
