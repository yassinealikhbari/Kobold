<script setup lang="ts">
import { onMounted, ref } from 'vue';

import TagChip from '@/components/TagChip.vue';
import { useProfileStore } from '@/stores/profile';

const profile = useProfileStore();
const skillInput = ref('');

function addSkill() {
  const skill = skillInput.value.trim();
  if (!skill) return;
  profile.profile.skills.push(skill);
  skillInput.value = '';
}

function removeSkill(index: number) {
  profile.profile.skills.splice(index, 1);
}

function addLanguage() {
  profile.profile.languages.push({ lang: '', level: '' });
}

function addWorkHistory() {
  profile.profile.work_history.push({ company: '', role: '', from: '', to: '', highlights: [''] });
}

function addHighlight(index: number) {
  profile.profile.work_history[index]?.highlights.push('');
}

async function uploadCv(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  await profile.uploadCv(file);
  input.value = '';
}

async function downloadCv() {
  const url = await profile.fetchCvUrl();
  window.open(url, '_blank', 'noreferrer');
}

onMounted(() => {
  void profile.fetchProfile();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <p class="eyebrow">Candidate</p>
      <h1>Profile</h1>
    </header>

    <p v-if="profile.error" class="form-error">{{ profile.error }}</p>

    <form class="profile-form" @submit.prevent="profile.saveProfile">
      <section class="panel form-section">
        <h2>Contact</h2>
        <div class="form-grid">
          <label>
            Full name
            <input v-model="profile.profile.full_name" type="text" />
          </label>
          <label>
            Email
            <input v-model="profile.profile.email" type="email" />
          </label>
          <label>
            Phone
            <input v-model="profile.profile.phone" type="tel" />
          </label>
          <label>
            Location
            <input v-model="profile.profile.location" type="text" />
          </label>
          <label>
            LinkedIn
            <input v-model="profile.profile.linkedin" type="url" />
          </label>
          <label>
            GitHub
            <input v-model="profile.profile.github" type="url" />
          </label>
          <label>
            Portfolio
            <input v-model="profile.profile.portfolio" type="url" />
          </label>
        </div>

        <label>
          Summary
          <textarea v-model="profile.profile.summary" rows="4"></textarea>
        </label>
      </section>

      <section class="panel form-section">
        <h2>Skills</h2>
        <div class="inline-add">
          <input v-model="skillInput" type="text" placeholder="Add skill" @keydown.enter.prevent="addSkill" />
          <button type="button" @click="addSkill">Add</button>
        </div>
        <div class="chip-row">
          <TagChip v-for="(skill, index) in profile.profile.skills" :key="skill" :label="skill" removable @remove="removeSkill(index)" />
        </div>
      </section>

      <section class="panel form-section">
        <div class="section-heading">
          <h2>Languages</h2>
          <button type="button" @click="addLanguage">Add</button>
        </div>
        <div v-for="(language, index) in profile.profile.languages" :key="index" class="repeat-row">
          <input v-model="language.lang" type="text" placeholder="Language" />
          <input v-model="language.level" type="text" placeholder="Level" />
          <button type="button" @click="profile.profile.languages.splice(index, 1)">Remove</button>
        </div>
      </section>

      <section class="panel form-section">
        <div class="section-heading">
          <h2>Work History</h2>
          <button type="button" @click="addWorkHistory">Add</button>
        </div>
        <div v-for="(work, index) in profile.profile.work_history" :key="index" class="work-entry">
          <div class="form-grid">
            <input v-model="work.company" type="text" placeholder="Company" />
            <input v-model="work.role" type="text" placeholder="Role" />
            <input v-model="work.from" type="text" placeholder="From" />
            <input v-model="work.to" type="text" placeholder="To" />
          </div>
          <div v-for="(_highlight, highlightIndex) in work.highlights" :key="highlightIndex" class="repeat-row">
            <input v-model="work.highlights[highlightIndex]" type="text" placeholder="Highlight" />
            <button type="button" @click="work.highlights.splice(highlightIndex, 1)">Remove</button>
          </div>
          <div class="action-row">
            <button type="button" @click="addHighlight(index)">Add highlight</button>
            <button type="button" @click="profile.profile.work_history.splice(index, 1)">Remove role</button>
          </div>
        </div>
      </section>

      <section class="panel form-section">
        <h2>CV</h2>
        <p class="subtle">
          {{ profile.profile.cv_path ? `Current file: ${profile.profile.cv_path}` : 'No CV uploaded.' }}
        </p>
        <div class="action-row">
          <input type="file" accept="application/pdf" @change="uploadCv" />
          <button type="button" :disabled="!profile.profile.cv_path" @click="downloadCv">Download CV</button>
        </div>
        <p v-if="!profile.complete" class="form-hint">Summary and CV are required for the apply flow.</p>
      </section>

      <div class="sticky-actions">
        <button type="submit" :disabled="profile.saving">
          {{ profile.saving ? 'Saving' : 'Save profile' }}
        </button>
      </div>
    </form>
  </section>
</template>
