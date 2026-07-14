<script setup lang="ts">
import { onMounted } from 'vue';

import TagChip from '@/components/TagChip.vue';
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

    <section class="panel form-section notification-settings">
      <div class="section-heading">
        <h2>Telegram Digest</h2>
        <TagChip
          :label="settings.telegramConfigured ? 'Connected' : 'Not configured'"
          :tone="settings.telegramConfigured ? 'muted' : 'warning'"
        />
      </div>

      <div class="notification-metrics">
        <div>
          <span>Schedule</span>
          <strong>Every 3 hours</strong>
        </div>
        <div>
          <span>Tracked IDs</span>
          <strong>{{ settings.notificationStatus.tracked }}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{{ settings.notificationStatus.pending }}</strong>
        </div>
        <div>
          <span>Last sent</span>
          <strong>
            {{ settings.notificationStatus.lastNotifiedAt ? absoluteDate(settings.notificationStatus.lastNotifiedAt) : 'Never' }}
          </strong>
        </div>
      </div>

      <p v-if="settings.notificationStatus.migrationRequired" class="form-error">
        Apply migration 006_job_fingerprints.sql to activate duplicate-safe alerts.
      </p>
      <p v-else-if="!settings.telegramConfigured" class="form-hint">
        Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.
      </p>

      <label class="check-field">
        <input
          v-model="settings.settings.notify_enabled"
          type="checkbox"
          :disabled="
            settings.notificationStatus.migrationRequired ||
            (!settings.telegramConfigured && !settings.settings.notify_enabled)
          "
        />
        Send one combined new-job digest
      </label>
      <button
        type="button"
        :disabled="
          settings.saving ||
          settings.notificationStatus.migrationRequired ||
          (!settings.telegramConfigured && settings.settings.notify_enabled)
        "
        @click="settings.saveSettings"
      >
        {{ settings.saving ? 'Saving' : 'Save alerts' }}
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
      <h2>Ingest Runs</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Started</th>
              <th>Found</th>
              <th>Matched</th>
              <th>New IDs</th>
              <th>Sent</th>
              <th>Pending</th>
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
              <td>{{ run.inserted_active ?? 0 }}</td>
              <td>{{ run.inserted_dismissed ?? 0 }}</td>
              <td>{{ run.error || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
