import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET as getSummary } from '@/app/api/v1/operator/growth/summary/route';

const OPERATOR_KEY = 'gathering-operator-test-key'.padEnd(48, 'x');

function report() {
  return {
    ordered_funnel: [],
    diagnostic_totals: {
      source_of_truth: 'independent_client_events',
      vella_profile_initialized: {
        unique_installs: 0,
        event_count: 0,
        source_of_truth: 'vella_profile_initialized',
      },
      funnel: [],
      daily: [],
      cohorts: [],
      campaigns: [],
      authoritative_subscriptions: {
        verified_starts: 0,
        active_now: 0,
        auto_renew_off_now: 0,
        ended_updates: 0,
        by_provider_product: [],
        source_of_truth: 'verified_store_subscriptions',
      },
      webhook_health: { received: 0, processed: 0, pending: 0, by_provider: [] },
    },
    release_cohorts: [],
    authoritative_transitions: {
      trial_started: 0,
      paid_started: 0,
      by_day: [],
      by_provider_plan: [],
      source_of_truth: 'subscription_marketing_transitions',
    },
    window: { from: '2026-08-01', to: '2026-08-27', cohort_days: 14 },
    funnel: [],
    daily: [],
    cohorts: [],
    campaigns: [],
    authoritative_subscriptions: {
      verified_starts: 0,
      active_now: 0,
      auto_renew_off_now: 0,
      ended_updates: 0,
      by_provider_product: [],
      source_of_truth: 'verified_store_subscriptions',
    },
    webhook_health: { received: 0, processed: 0, pending: 0, by_provider: [] },
    privacy: {
      raw_retention_days: 90,
      minimum_breakdown_installs: 20,
      small_cohorts_omitted: true,
      small_campaign_metrics_suppressed: true,
      small_subscription_product_groups_omitted: true,
      contains_ip_or_raw_content: false,
      contains_account_identifier: false,
      client_subscription_events_are_authoritative: false,
    },
  };
}

type Fixture = {
  errorTable?: string;
  selections: Array<{ table: string; columns: string }>;
};

function serviceClient(fixture: Fixture) {
  const rpc = vi.fn((name: string) => name === 'growth_subscription_attribution_truth'
    ? queryBuilder(fixture, 'growth_subscription_attribution_truth', [])
    : Promise.resolve({ data: report(), error: null }));

  const from = vi.fn((table: string) => queryBuilder(fixture, table));
  return { rpc, from };
}

function queryBuilder(
  fixture: Fixture,
  table: string,
  rows: Record<string, unknown>[] = [],
) {
  let eventName: string | null = null;
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const result = () => {
    if (fixture.errorTable === table) return { data: null, error: { message: 'hidden db detail' } };
    if (table === 'gathering_releases') return { data: Array.from({ length: 12 }, (_, index) => ({
      release_week: new Date(Date.UTC(2026, 8, 7 + Math.floor(index / 2) * 7)).toISOString().slice(0, 10),
      slot_type: index % 2 === 0 ? 'monday' : 'thursday',
      source_kind: 'generated',
      status: 'published',
      published_at: '2026-09-01T00:00:00.000Z',
      prompt_revision: 'gathering-factory.1',
      editorial_revision: 'editorial.1',
    })), error: null };
    if (table === 'gathering_generation_runs') return { data: [
      { target_week: '2026-09-07', slot_type: 'monday', lifecycle_state: 'published', model_identifier: 'gpt-5.6-sol', prompt_revision: 'gathering-factory.1', validation_result: 'accepted', reviewer_result: 'approved', input_tokens: 100, output_tokens: 50, cost_microunits: 700, started_at: '2026-08-26T01:00:00.000Z', completed_at: '2026-08-26T01:01:00.000Z', safe_error_code: null },
      { target_week: '2026-09-14', slot_type: 'thursday', lifecycle_state: 'failed', model_identifier: 'gpt-5.6-sol', prompt_revision: 'gathering-factory.1', validation_result: 'rejected', reviewer_result: 'not_run', input_tokens: 20, output_tokens: 10, cost_microunits: 30, started_at: '2026-08-25T01:00:00.000Z', completed_at: '2026-08-25T01:01:00.000Z', safe_error_code: 'validation_failed' },
    ], error: null };
    if (table === 'gathering_automation_heartbeats') return { data: [
      { heartbeat_source: 'vercel_cron', heartbeat_state: 'healthy', inventory_depth: 12, observed_at: '2026-08-27T01:00:00.000Z', safe_error_code: null },
    ], error: null };
    if (table === 'gathering_generation_incidents') return { data: [], error: null };
    if (table === 'gathering_content_metrics_daily') return { data: [
      { metric_date: '2026-08-26', slot_type: 'monday', views: 10, starts: 6, completions: 3, resumes: 2, step_dropoffs: 1 },
    ], error: null };
    if (table === 'gathering_operational_events') return { data: [
      { event_name: 'api_catalog_succeeded', event_state: 'succeeded', occurred_at: '2026-08-26T01:00:00.000Z', safe_error_code: null },
      { event_name: 'publish_finished', event_state: 'succeeded', occurred_at: '2026-08-26T01:00:00.000Z', safe_error_code: null },
      { event_name: 'heartbeat_recorded', event_state: 'succeeded', occurred_at: '2026-08-27T01:00:00.000Z', safe_error_code: null },
    ], error: null };
    if (table === 'growth_analytics_events') {
      if (eventName === 'onboarding_step' || eventName === 'onboarding_step_result' || eventName === 'onboarding_interaction' ||
        eventName === 'onboarding_error' || eventName === 'onboarding_completed' || eventName === 'route_resolved' ||
        eventName === 'first_open' || eventName === 'onboarding_started' || eventName === 'auth_started' ||
        eventName === 'auth_attempt' || eventName === 'first_experience_viewed' || eventName === 'first_experience_step' ||
        eventName === 'first_experience_completed' || eventName === 'first_experience_error') return { data: [], error: null };
      return { data: [
        { event_name: 'gathering_card_viewed', properties: {} },
        { event_name: 'gathering_started', properties: {} },
        { event_name: 'gathering_session_abandoned', properties: { step_index: 4 } },
        { event_name: 'gathering_completed', properties: {} },
        { event_name: 'gathering_replayed', properties: {} },
        { event_name: 'gathering_fallback_used', properties: {} },
      ], error: null };
    }
    return { data: rows, error: null };
  };

  builder.select = vi.fn((columns: string) => {
    fixture.selections.push({ table, columns });
    return builder;
  });
  builder.eq = vi.fn((column: string, value: unknown) => {
    if (table === 'growth_analytics_events' && column === 'event_name') eventName = String(value);
    return builder;
  });
  for (const method of ['in', 'gte', 'lt', 'gt', 'lte', 'or', 'order']) builder[method] = vi.fn(() => builder);
  builder.limit = vi.fn(async () => {
    const resolved = result();
    return { ...resolved, count: Array.isArray(resolved.data) ? resolved.data.length : null };
  });
  builder.range = vi.fn(async () => {
    const resolved = result();
    return { ...resolved, count: Array.isArray(resolved.data) ? resolved.data.length : null };
  });
  return builder;
}

function request() {
  return new Request('https://vella.one/api/v1/operator/growth/summary?from=2026-08-01&to=2026-08-27', {
    headers: { 'x-vella-operator-key': OPERATOR_KEY },
  });
}

describe('gathering automation operator diagnostics', () => {
  beforeEach(() => {
    vi.stubEnv('VELLA_OPERATOR_API_KEY', OPERATOR_KEY);
  });

  it('reports bounded inventory, factory health, telemetry, and no private fields', async () => {
    const fixture: Fixture = { selections: [] };
    mocks.createServiceClient.mockReturnValue(serviceClient(fixture));

    const response = await getSummary(request());
    const json = await response.json() as { data: Record<string, any> };
    const diagnostics = json.data.gathering_automation;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(diagnostics).toEqual(expect.objectContaining({
      audit_available: true,
      future_inventory: 12,
      weeks_covered: 6,
      next_monday_at: expect.any(String),
      next_thursday_at: expect.any(String),
      last_run: expect.objectContaining({ outcome: 'succeeded', model: 'gpt-5.6-sol' }),
      open_incidents: [],
      telemetry: expect.objectContaining({ app: expect.any(Object), api: expect.any(Object), cron: expect.any(Object) }),
    }));
    expect(diagnostics.last_successful_publish).toEqual(expect.objectContaining({ outcome: 'succeeded' }));
    expect(diagnostics.last_heartbeat).toEqual(expect.objectContaining({ source: 'vercel_cron', state: 'healthy' }));
    expect(diagnostics.model_revision).toEqual({ model: 'gpt-5.6-sol', prompt_revision: 'gathering-factory.1' });
    expect(diagnostics.token_totals).toEqual({ input: 120, output: 60, total: 180 });
    expect(diagnostics.cost_totals).toEqual({ microunits: 730 });
    expect(diagnostics.alert_delivery).toEqual({ pending: 0, delivered: 0, failed: 0, not_needed: 0, attempts: 0 });
    expect(diagnostics.rejection_codes).toEqual([{ code: 'validation_failed', count: 1 }]);
    expect(diagnostics.telemetry.app).toEqual(expect.objectContaining({ starts: 1, completions: 1, step_dropoffs: 1, replays: 1, fallbacks: 1 }));
    expect(diagnostics.telemetry.api).toEqual(expect.objectContaining({ requests: 0, successes: 1, failures: 0 }));
    expect(diagnostics.telemetry.cron).toEqual(expect.objectContaining({ successes: 3, heartbeats: 1, publishes: 1 }));
    expect(JSON.stringify(json)).not.toMatch(/user_id|email|content_body|prompt_body/i);
    expect(fixture.selections.map(({ columns }) => columns).join('|')).not.toMatch(/user_id|email|content_body|prompt_body|receipt|secret/i);
  });

  it('returns only audit availability when a required gathering source fails', async () => {
    const fixture: Fixture = { errorTable: 'gathering_generation_runs', selections: [] };
    mocks.createServiceClient.mockReturnValue(serviceClient(fixture));

    const response = await getSummary(request());
    const json = await response.json() as { data: Record<string, any> };

    expect(response.status).toBe(200);
    expect(json.data.gathering_automation).toEqual({ audit_available: false });
  });
});
