<script setup lang="ts">
import { onMounted } from 'vue';

import { absoluteDate } from '@/lib/dates';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

onMounted(() => {
  void settings.fetchSettings();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <p class="eyebrow">System</p>
      <h1>Settings</h1>
    </header>

    <p v-if="settings.error" class="form-error">{{ settings.error }}</p>

    <section class="panel form-section">
      <h2>Notifications</h2>
      <p v-if="!settings.telegramConfigured" class="form-hint">Configure Telegram credentials to enable notifications.</p>
      <label class="check-field">
        <input v-model="settings.settings.notify_enabled" type="checkbox" :disabled="!settings.telegramConfigured" />
        <span>Telegram notifications enabled</span>
      </label>
      <label>
        Minimum score
        <input v-model.number="settings.settings.min_score_notify" type="number" min="-3" max="12" />
      </label>
      <button type="button" :disabled="settings.saving" @click="settings.saveSettings">
        {{ settings.saving ? 'Saving' : 'Save settings' }}
      </button>
    </section>

    <section class="panel form-section">
      <h2>Source Health</h2>
      <div v-if="settings.sourceHealth.length === 0" class="subtle">No source runs recorded yet.</div>
      <article v-for="source in settings.sourceHealth" :key="source.source" class="settings-row">
        <div>
          <strong>{{ source.source }}</strong>
          <p class="subtle">
            {{ source.last_outcome }} · {{ source.last_found }} found · {{ source.last_matched }} matched
            <span v-if="source.last_duration_ms"> · {{ source.last_duration_ms }} ms</span>
          </p>
          <p v-if="source.last_error" class="form-error">{{ source.last_error }}</p>
        </div>
        <button type="button" :disabled="settings.saving" @click="settings.rerunSource(source.source)">Rerun</button>
      </article>
    </section>

    <section class="panel form-section">
      <h2>Hidden Jobs</h2>
      <div v-if="settings.hiddenJobs.length === 0" class="subtle">No hidden jobs.</div>
      <article v-for="job in settings.hiddenJobs" :key="job.id" class="settings-row">
        <div>
          <strong>{{ job.title }}</strong>
          <p class="subtle">{{ job.company }} · {{ job.german_required ? 'German filtered' : 'Dismissed' }}</p>
        </div>
        <button type="button" @click="settings.restoreJob(job.id)">Restore</button>
      </article>
    </section>

    <section class="panel form-section">
      <h2>Ingest Runs</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Started</th>
              <th>Found</th>
              <th>Matched</th>
              <th>Inserted</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in settings.runs" :key="run.id">
              <td>{{ run.source }}</td>
              <td>{{ absoluteDate(run.started_at) }}</td>
              <td>{{ run.found }}</td>
              <td>{{ run.matched }}</td>
              <td>{{ run.inserted }}</td>
              <td>{{ run.error || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
