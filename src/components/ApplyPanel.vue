<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { apiFetch } from '@/lib/api';
import { useProfileStore } from '@/stores/profile';
import type { Application } from '@/types/applications';
import type { Job } from '@/types/jobs';

const props = defineProps<{
  job: Job;
}>();

const emit = defineEmits<{
  applied: [];
}>();

const profile = useProfileStore();
const application = ref<Application | null>(null);
const letter = ref('');
const instructions = ref('');
const generating = ref(false);
const savingLetter = ref(false);
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
  { label: 'Salary expectation', value: '' },
]);

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
    emit('applied');
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
</script>

<template>
  <section class="panel apply-panel">
    <h2>Apply Prep</h2>

    <div class="copy-grid">
      <div v-for="field in copyFields" :key="field.label" class="copy-field">
        <span>
          <strong>{{ field.label }}</strong>
          <small>{{ field.value || 'Not set' }}</small>
        </span>
        <button type="button" @click="copy(field.value)">Copy</button>
      </div>
    </div>

    <div class="cover-letter-block">
      <div class="section-heading">
        <h3>Cover letter</h3>
        <button type="button" :disabled="generating" @click="generateLetter">
          {{ letter ? 'Regenerate' : generating ? 'Generating' : 'Generate' }}
        </button>
      </div>
      <input v-model="instructions" type="text" placeholder="Extra instructions" />
      <textarea v-model="letter" rows="10" placeholder="Generated letter appears here"></textarea>
      <div class="action-row">
        <button type="button" :disabled="!letter" @click="copy(letter)">Copy letter</button>
        <span v-if="savingLetter" class="subtle">Saving...</span>
      </div>
    </div>

    <div class="cv-block">
      <h3>CV</h3>
      <p class="subtle">{{ profile.profile.cv_path ? profile.profile.cv_path : 'No CV uploaded.' }}</p>
      <button type="button" :disabled="!profile.profile.cv_path" @click="downloadCv">Download CV</button>
    </div>

    <div class="ats-row">
      <span>{{ job.ats || 'ATS unknown' }}</span>
      <a class="button-link" :href="job.apply_url ?? job.url" target="_blank" rel="noreferrer">Open application form</a>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <button type="button" class="primary-action" :disabled="markingApplied || application?.status === 'applied'" @click="markApplied">
      {{ application?.status === 'applied' ? 'Marked as applied' : markingApplied ? 'Updating' : 'Mark as applied' }}
    </button>
  </section>
</template>
