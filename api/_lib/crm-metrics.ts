export type MetricOrganization = { created_at: string };
export type MetricOpportunity = {
  id: string;
  stage: string;
  value_cents: number | null;
  currency: string;
  lost_reason: string | null;
};
export type MetricActivity = {
  subject_id: string;
  kind: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export function calculateCrmMetrics(
  organizations: MetricOrganization[],
  opportunities: MetricOpportunity[],
  activities: MetricActivity[],
  now = new Date(),
) {
  const eventsByOpportunity = new Map<string, MetricActivity[]>();
  for (const event of activities) {
    const events = eventsByOpportunity.get(event.subject_id) ?? [];
    events.push(event);
    eventsByOpportunity.set(event.subject_id, events);
  }
  for (const events of eventsByOpportunity.values()) {
    events.sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  }

  const reached = (stage: string) =>
    opportunities.filter((opportunity) =>
      (eventsByOpportunity.get(opportunity.id) ?? []).some(
        (event) => event.metadata.to === stage || event.metadata.stage === stage,
      ),
    );
  const contacted = reached('contacted');
  const conversations = reached('conversation');
  const proposals = reached('proposal');
  const won = reached('won');

  return {
    newLeadsPerWeek: groupByWeek(organizations.map((item) => item.created_at)),
    contactToConversationRate: ratio(
      conversations.filter((item) => contacted.some((contact) => contact.id === item.id)).length,
      contacted.length,
    ),
    proposalWinRate: ratio(
      won.filter((item) => proposals.some((proposal) => proposal.id === item.id)).length,
      proposals.length,
    ),
    averageDaysPerStage: averageStageDays(eventsByOpportunity, now),
    pipelineValueOverTime: pipelineValueEvents(eventsByOpportunity),
    lossReasons: lossReasonBreakdown(activities),
    currentPipelineByCurrency: currentPipeline(opportunities),
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function groupByWeek(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const date = new Date(value);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, count]) => ({ week, count }));
}

function averageStageDays(eventsByOpportunity: Map<string, MetricActivity[]>, now: Date) {
  const durations = new Map<string, number[]>();
  for (const events of eventsByOpportunity.values()) {
    const stageEvents = events.filter((event) => {
      const stage = event.metadata.to ?? event.metadata.stage;
      return typeof stage === 'string';
    });
    for (let index = 0; index < stageEvents.length; index += 1) {
      const event = stageEvents[index]!;
      const stage = String(event.metadata.to ?? event.metadata.stage);
      const end = stageEvents[index + 1]?.occurred_at ?? now.toISOString();
      const days = Math.max(
        0,
        (new Date(end).getTime() - new Date(event.occurred_at).getTime()) / 86_400_000,
      );
      const values = durations.get(stage) ?? [];
      values.push(days);
      durations.set(stage, values);
    }
  }
  return [...durations.entries()].map(([stage, values]) => ({
    stage,
    days: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
  }));
}

function pipelineValueEvents(eventsByOpportunity: Map<string, MetricActivity[]>) {
  const allEvents = [...eventsByOpportunity.entries()]
    .flatMap(([id, events]) => events.map((event) => ({ id, event })))
    .filter(({ event }) =>
      event.metadata.metrics_baseline === true ||
      'new_value_cents' in event.metadata ||
      typeof event.metadata.to === 'string',
    )
    .sort((left, right) => left.event.occurred_at.localeCompare(right.event.occurred_at));
  const state = new Map<string, { stage: string; value: number; currency: string }>();
  const points: Array<{ at: string; values: Record<string, number> }> = [];
  for (const { id, event } of allEvents) {
    if (!state.has(id) && event.metadata.metrics_baseline !== true) continue;
    const current = state.get(id) ?? { stage: 'lead', value: 0, currency: 'EUR' };
    const metadata = event.metadata;
    const next = {
      stage:
        typeof metadata.to === 'string'
          ? metadata.to
          : typeof metadata.stage === 'string'
            ? metadata.stage
            : current.stage,
      value:
        typeof metadata.new_value_cents === 'number'
          ? metadata.new_value_cents
          : typeof metadata.value_cents === 'number'
            ? metadata.value_cents
            : current.value,
      currency:
        typeof metadata.new_currency === 'string'
          ? metadata.new_currency
          : typeof metadata.currency === 'string'
            ? metadata.currency
            : current.currency,
    };
    state.set(id, next);
    const values: Record<string, number> = {};
    for (const item of state.values()) {
      if (['won', 'lost'].includes(item.stage)) continue;
      values[item.currency] = (values[item.currency] ?? 0) + item.value;
    }
    points.push({ at: event.occurred_at, values });
  }
  return points;
}

function lossReasonBreakdown(activities: MetricActivity[]) {
  const counts = new Map<string, number>();
  for (const activity of activities) {
    if (activity.metadata.to !== 'lost' || typeof activity.metadata.lost_reason !== 'string') continue;
    const reason = activity.metadata.lost_reason;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));
}

function currentPipeline(opportunities: MetricOpportunity[]) {
  const totals: Record<string, number> = {};
  for (const opportunity of opportunities) {
    if (['won', 'lost'].includes(opportunity.stage)) continue;
    totals[opportunity.currency] = (totals[opportunity.currency] ?? 0) + (opportunity.value_cents ?? 0);
  }
  return totals;
}
