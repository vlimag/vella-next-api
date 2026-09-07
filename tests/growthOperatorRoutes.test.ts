import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET as getSummary } from '@/app/api/v1/operator/growth/summary/route';
import { POST as saveSpend } from '@/app/api/v1/operator/growth/spend/route';
import * as growthDashboardModule from '@/components/operator/GrowthDashboard';

const OPERATOR_KEY = 'growth-operator-test-key'.padEnd(48, 'x');

function headers() {
  return { 'x-vella-operator-key': OPERATOR_KEY };
}

function adversarialPrivacySentinels() {
  return [
    ['identifier', 'i'.repeat(32)].join('_'),
    ['privacy-fixture', 'invalid.example'].join('@'),
    ['token', 't'.repeat(48)].join('_'),
    ['receipt', 'r'.repeat(48)].join('_'),
    'f'.repeat(64),
  ];
}

function renderedText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (isValidElement(value)) {
    return renderedText((value.props as { children?: unknown }).children);
  }
  return '';
}

function orderedReportBlocks() {
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
  };
}

function mockGrowthRpcs(
  report: Record<string, unknown>,
  attributionRows: Record<string, unknown>[] = [],
  attributionError: Record<string, unknown> | null = null,
) {
  const attributionBuilder: {
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
  } = {
    order: vi.fn(),
    range: vi.fn(),
  };
  attributionBuilder.order.mockImplementation(() => attributionBuilder);
  attributionBuilder.range.mockImplementation((from: number, to: number) => Promise.resolve({
    data: attributionRows.slice(from, to + 1),
    error: attributionError,
    count: attributionError ? null : attributionRows.length,
  }));
  const rpc = vi.fn((name: string) => {
    if (name === 'growth_subscription_attribution_truth') return attributionBuilder;
    return Promise.resolve({ data: report, error: null });
  });
  return { rpc, attributionBuilder };
}

function subscriptionAttributionRows(
  count: number,
  overrides: Record<string, unknown>,
  idOffset = 0,
) {
  return Array.from({ length: count }, (_, index) => ({
    transition_id: `70000000-0000-4000-8000-${String(idOffset + index).padStart(12, '0')}`,
    attribution_scope: 'source_qualified',
    subscription_provider: 'google',
    plan: 'yearly',
    phase: 'paid',
    occurred_at: '2026-07-05T12:00:00.000Z',
    platform: 'android',
    attribution_provider: 'play_install_referrer',
    source: 'google',
    medium: 'cpc',
    campaign: 'vella_br_android_202608_prayerdaily',
    creative_code: null,
    org_id: null,
    campaign_id: null,
    ad_group_id: null,
    keyword_id: null,
    ad_id: null,
    supply_placement: null,
    conversion_type: null,
    ...overrides,
  }));
}

type MockTableQueryResult = {
  data: unknown;
  error: unknown;
  count?: number | null;
};

function mockTableQueries(
  resolve: (table: string, eventName: string) => MockTableQueryResult = () => ({
    data: [],
    error: null,
  }),
) {
  const buildersByTable = new Map<string, Array<Record<string, ReturnType<typeof vi.fn>>>>();
  const from = vi.fn((table: string) => {
    let eventName = '';
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    const result = () => resolve(table, eventName);

    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((column: string, value: string) => {
      if (column === 'event_name') eventName = value;
      return builder;
    });
    builder.in = vi.fn(() => builder);
    builder.gte = vi.fn(() => builder);
    builder.lt = vi.fn(() => builder);
    builder.or = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(async (maximum?: number) => {
      const resolved = result();
      return {
        data: Array.isArray(resolved.data) && typeof maximum === 'number'
          ? resolved.data.slice(0, maximum)
          : resolved.data,
        error: resolved.error,
        count: resolved.count === undefined
          ? Array.isArray(resolved.data) ? resolved.data.length : null
          : resolved.count,
      };
    });
    builder.range = vi.fn(async (fromIndex: number, toIndex: number) => {
      const resolved = result();
      return {
        data: Array.isArray(resolved.data)
          ? resolved.data.slice(fromIndex, toIndex + 1)
          : resolved.data,
        error: resolved.error,
        count: resolved.count === undefined
          ? Array.isArray(resolved.data) ? resolved.data.length : null
          : resolved.count,
      };
    });

    const tableBuilders = buildersByTable.get(table) ?? [];
    tableBuilders.push(builder);
    buildersByTable.set(table, tableBuilders);
    return builder;
  });

  return { from, buildersByTable };
}

type RecordedOperatorQuery = {
  table: string;
  filters: Array<{ method: string; column: string; value: unknown }>;
  limit?: number;
  range?: [number, number];
  selection?: { columns: string; options: unknown };
};

function rhythmsOperatorReport() {
  return {
    ...orderedReportBlocks(),
    window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
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

function mockRhythmsOperatorClient(
  resolve: (query: RecordedOperatorQuery) => MockTableQueryResult | Promise<MockTableQueryResult>,
) {
  const { rpc } = mockGrowthRpcs(rhythmsOperatorReport());
  const queries: RecordedOperatorQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedOperatorQuery = { table, filters: [] };
    queries.push(query);
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn((columns: string, options?: unknown) => {
      query.selection = { columns, options };
      return builder;
    });
    for (const method of ['eq', 'gte', 'gt', 'lte', 'lt', 'in', 'order']) {
      builder[method] = vi.fn((column: string, value: unknown) => {
        query.filters.push({ method, column, value });
        return builder;
      });
    }
    builder.or = vi.fn((expression: string) => {
      query.filters.push({ method: 'or', column: '', value: expression });
      return builder;
    });
    builder.limit = vi.fn(async (maximum?: number) => {
      query.limit = maximum;
      const result = await resolve(query);
      const orders = query.filters.filter((filter) => filter.method === 'order');
      const orderedData = Array.isArray(result.data) ? [...result.data].sort((left, right) => {
        if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return 0;
        for (const order of orders) {
          const leftValue = (left as Record<string, unknown>)[order.column];
          const rightValue = (right as Record<string, unknown>)[order.column];
          const comparison = String(leftValue).localeCompare(String(rightValue));
          if (comparison !== 0) {
            return (order.value as { ascending?: boolean }).ascending === false ? -comparison : comparison;
          }
        }
        return 0;
      }) : result.data;
      return {
        data: Array.isArray(orderedData) && typeof maximum === 'number'
          ? orderedData.slice(0, Math.min(maximum, 1000))
          : orderedData,
        error: result.error,
        count: result.count === undefined
          ? Array.isArray(result.data) ? result.data.length : null
          : result.count,
      };
    });
    builder.range = vi.fn(async (fromIndex: number, toIndex: number) => {
      query.range = [fromIndex, toIndex];
      const result = await resolve(query);
      const cappedToIndex = Math.min(toIndex, fromIndex + 999);
      return {
        data: Array.isArray(result.data) ? result.data.slice(fromIndex, cappedToIndex + 1) : result.data,
        error: result.error,
        count: result.count === undefined
          ? Array.isArray(result.data) ? result.data.length : null
          : result.count,
      };
    });
    return builder;
  });
  mocks.createServiceClient.mockReturnValue({ rpc, from });
  return { queries };
}

function pagedRhythmsAnalyticsRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    event_id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000001`,
    installation_id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
    event_name: 'rhythms_hub_viewed',
    received_at: new Date(Date.UTC(2026, 6, 1) + index * 1000).toISOString(),
    platform: 'android',
    app_version: '2.0.0',
    build_number: '200',
    runtime_version: '2.0',
  }));
}

function pagedQuery(limit: ReturnType<typeof vi.fn>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.limit = limit;
  builder.order = vi.fn(() => builder);
  builder.range = vi.fn(async (fromIndex: number, toIndex: number) => {
    const resolved = await limit() as { data: unknown; error: unknown };
    return {
      ...resolved,
      data: Array.isArray(resolved.data)
        ? resolved.data.slice(fromIndex, toIndex + 1)
        : resolved.data,
      count: Array.isArray(resolved.data) ? resolved.data.length : null,
    };
  });
  return builder;
}

function mockSummaryClient(report: Record<string, unknown>) {
  const { rpc } = mockGrowthRpcs(report);
  const limit = vi.fn().mockResolvedValue({ data: [], error: null });
  const lt = vi.fn(() => pagedQuery(limit));
  const gte = vi.fn(() => ({ lt }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ gte, eq }));
  const from = vi.fn(() => ({ select }));
  mocks.createServiceClient.mockReturnValue({ rpc, from });
  return { rpc, from };
}

describe('growth operator routes', () => {
  beforeEach(() => {
    vi.stubEnv('VELLA_OPERATOR_API_KEY', OPERATOR_KEY);
    mocks.createServiceClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the aggregate report through the service-only RPC', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
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
        ordered_by_occurred_at: true,
        minimum_release_installs: 20,
        minimum_transition_subscriptions: 20,
        small_release_cohorts_omitted: true,
        small_transition_segments_omitted: true,
      },
    };
    const { rpc } = mockGrowthRpcs(report);
    const { from } = mockTableQueries();
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31&cohort_days=14',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ data: {
      ...report,
      attribution_economics: {
        audit_available: true,
        spend_audit_available: true,
        row_limit_reached: false,
        spend_row_limit_reached: false,
        minimum_breakdown_transitions: 20,
        mature_after_days: 16,
        provisional_cac_ceiling_cents: 6000,
        source_qualified: [],
        platform_blended: [],
        campaign_economics: [],
        not_attributable_campaigns: [],
      },
      onboarding_steps: [],
      onboarding_step_results: [],
      rhythms_diagnostics: {
        audit_available: true,
        source_of_truth: {
          discovery_and_presentation: 'growth_analytics_events',
          completions_and_awards: 'rhythms_product_tables',
        },
        journey_funnel: {
          hub_views: 0,
          catalog_views: 0,
          detail_views: 0,
          starts: 0,
          first_session_completions: 0,
          journey_completions: 0,
        },
        practice: { catalog_views: 0, weekly_rhythms_saved: 0, session_completions: 0 },
        gathering: { views: 0, starts: 0, completions: 0 },
        milestones: { earned: 0, revealed: 0, featured: 0 },
        failures: { idempotency_conflicts: 0, server_errors: 0 },
        cohorts: { minimum_installations: 20, releases: [], runtimes: [], builds: [] },
      },
      gathering_automation: {
        audit_available: true,
        future_inventory: 0,
        weeks_covered: 0,
        next_monday_at: null,
        next_thursday_at: null,
        last_run: null,
        last_successful_publish: null,
        last_heartbeat: null,
        model_revision: null,
        token_totals: { input: 0, output: 0, total: 0 },
        cost_totals: { microunits: 0 },
        rejection_codes: [],
        open_incidents: [],
        alert_delivery: { pending: 0, delivered: 0, failed: 0, not_needed: 0, attempts: 0 },
        telemetry: {
          app: { views: 0, catalog_views: 0, starts: 0, step_dropoffs: 0, completions: 0, resumes: 0, replays: 0, fallbacks: 0 },
          api: { requests: 0, successes: 0, failures: 0 },
          cron: { invocations: 0, successes: 0, failures: 0, heartbeats: 0, publishes: 0, alerts: 0 },
        },
        aggregate_metrics: { views: 0, starts: 0, completions: 0, resumes: 0, step_dropoffs: 0 },
      },
      onboarding_diagnostics: {
        audit_available: true,
        by_step_duration: [],
        by_interaction: [],
        by_error: [],
        completion_profiles: [],
      },
      routing_diagnostics: {
        audit_available: true,
        decisions: 0,
        installs: 0,
        by_destination: [],
        by_load_time: [],
      },
      first_experience_diagnostics: {
        viewed_installs: 0,
        completed_installs: 0,
        error_installs: 0,
        completion_rate: null,
        steps: [],
        releases: [],
      },
      release_funnel: [],
      auth_diagnostics: {
        audit_available: true,
        screen_views: 0,
        screen_installs: 0,
        attempt_events: 0,
        attempt_installs: 0,
        by_entry_point: [],
        by_attempt: [],
        row_limit_reached: false,
      },
      iap_diagnostics: {
        audit_available: true,
        client_events: 0,
        client_failures: 0,
        server_failures: 0,
        verified_receipts: 0,
        conflict_attempts: 0,
        distinct_conflict_proofs: 0,
        repeated_conflict_attempts: 0,
        unfingerprinted_conflict_attempts: 0,
        by_client_issue: [],
        by_server_error: [],
        by_verified_phase: [],
        checkout_lifecycle: {
          audit_available: true,
          started_attempts: 0,
          terminal_attempts: 0,
          open_attempts: 0,
          open_over_2m: 0,
          legacy_uncorrelated_starts: 0,
          orphan_results: 0,
          duplicate_terminal_attempts: 0,
          by_outcome: [],
          by_stage: [],
        },
        row_limit_reached: false,
      },
    } });
    expect(rpc).toHaveBeenCalledWith('growth_analytics_summary', {
      p_from: '2026-07-01',
      p_to: '2026-07-31',
      p_cohort_days: 14,
    });
    expect(from).toHaveBeenCalledTimes(38);
  });

  it('projects ordered truth and independently enforces every 20-unit privacy threshold', async () => {
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialDimension = privacySentinels.join('|');
    const report = {
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [{ event_name: 'first_open', unique_installs: 21, event_count: 22 }],
      daily: [],
      cohorts: [
        { cohort_day: '2026-07-01', installs: 19 },
        { cohort_day: '2026-07-02', installs: 20 },
      ],
      campaigns: [
        {
          source: 'google', campaign: 'android_first_launch', spend_cents: 1900, currency: 'BRL',
          attributed_installs: 19, attribution_suppressed: false,
          landing_views: 19, store_cta_clicks: 19, first_opens: 19,
          trial_starts: 4, paid_starts: 1, cost_per_first_open_cents: 100,
          cost_per_trial_cents: 475, cost_per_paid_start_cents: 1900,
        },
        {
          source: 'google', campaign: 'android_launch_br', spend_cents: 2000, currency: 'BRL',
          attributed_installs: 20, attribution_suppressed: false,
          landing_views: 20, store_cta_clicks: 20, first_opens: 20,
          trial_starts: 4, paid_starts: 1, cost_per_first_open_cents: 100,
          cost_per_trial_cents: 500, cost_per_paid_start_cents: 2000,
        },
        {
          source: 'google', campaign: 'br_android_202608_prayer_words', spend_cents: 2100, currency: 'BRL',
          attributed_installs: 0, attribution_suppressed: false,
          landing_views: 19, store_cta_clicks: 19, first_opens: 19,
          trial_starts: 4, paid_starts: 1, cost_per_first_open_cents: 100,
          cost_per_trial_cents: 525, cost_per_paid_start_cents: 2100,
        },
      ],
      authoritative_subscriptions: {
        verified_starts: 1,
        active_now: 1,
        auto_renew_off_now: 0,
        ended_updates: 0,
        by_provider_product: [
          { provider: 'apple', product_id: 'vella.premium.yearly', subscriptions: 19, active_now: 19 },
          { provider: 'google', product_id: 'vella.premium.yearly', subscriptions: 20, active_now: 20 },
        ],
        source_of_truth: 'verified_store_subscriptions',
      },
      webhook_health: { received: 0, processed: 0, pending: 0, by_provider: [] },
      privacy: {
        raw_retention_days: 90,
        minimum_breakdown_installs: 19,
        small_cohorts_omitted: true,
        small_campaign_metrics_suppressed: true,
        small_subscription_product_groups_omitted: true,
        contains_ip_or_raw_content: false,
        contains_account_identifier: false,
        client_subscription_events_are_authoritative: false,
        ordered_by_occurred_at: false,
        minimum_release_installs: 19,
        minimum_transition_subscriptions: 19,
        small_release_cohorts_omitted: false,
        small_transition_segments_omitted: false,
      },
      ordered_funnel: [
        { funnel_variant: 'legacy_v1', event_name: 'first_open', stage_order: 1, unique_installs: 21 },
        { funnel_variant: 'legacy_v1', event_name: 'checkout_started', stage_order: 9, unique_installs: 1 },
        { funnel_variant: 'compact_v2', event_name: 'paywall_viewed', stage_order: 6, unique_installs: 2 },
        {
          funnel_variant: adversarialDimension,
          event_name: adversarialDimension,
          stage_order: 99,
          unique_installs: 99,
        },
      ],
      diagnostic_totals: {
        source_of_truth: 'independent_client_events',
        vella_profile_initialized: {
          unique_installs: 20,
          event_count: 21,
          source_of_truth: 'vella_profile_initialized',
        },
        funnel: [{ event_name: 'first_open', unique_installs: 21, event_count: 22 }],
        daily: [], cohorts: [], campaigns: [],
        authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
        webhook_health: {},
      },
      release_cohorts: [
        {
          app_version: '1.2.0', build_number: '20', runtime_version: '1.2',
          platform: 'ios', cohort_day: '2026-07-01',
          funnel_variant: 'legacy_v1', event_name: 'checkout_started', stage_order: 9,
          cohort_installations: 20, unique_installs: 1,
        },
        {
          app_version: '1.2.0', build_number: '19', runtime_version: '1.2',
          platform: 'android', cohort_day: '2026-07-02',
          funnel_variant: 'legacy_v1', event_name: 'first_open', stage_order: 1,
          cohort_installations: 19, unique_installs: 19,
        },
      ],
      authoritative_transitions: {
        trial_started: 0,
        paid_started: 1,
        by_day: [
          { day: '2026-07-01', phase: 'trial', transitions: 19, distinct_subscriptions: 19 },
          { day: '2026-07-02', phase: 'paid', transitions: 20, distinct_subscriptions: 20 },
        ],
        by_provider_plan: [
          { provider: 'apple', plan: 'yearly', phase: 'paid', transitions: 19, distinct_subscriptions: 19 },
          { provider: 'google', plan: 'yearly', phase: 'paid', transitions: 20, distinct_subscriptions: 20 },
          {
            provider: adversarialDimension, plan: adversarialDimension, phase: adversarialDimension,
            transitions: 20, distinct_subscriptions: 20,
          },
        ],
        source_of_truth: 'subscription_marketing_transitions',
      },
    };
    mockSummaryClient(report);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.ordered_funnel).toEqual([
      { funnel_variant: 'legacy_v1', event_name: 'first_open', stage_order: 1, unique_installs: 21 },
      { funnel_variant: 'legacy_v1', event_name: 'checkout_started', stage_order: 9, unique_installs: 1 },
      { funnel_variant: 'compact_v2', event_name: 'paywall_viewed', stage_order: 6, unique_installs: 2 },
    ]);
    expect(body.data.diagnostic_totals.source_of_truth).toBe('independent_client_events');
    expect(body.data.diagnostic_totals.vella_profile_initialized).toEqual({
      unique_installs: 20,
      event_count: 21,
      source_of_truth: 'vella_profile_initialized',
    });
    expect(body.data.privacy.minimum_breakdown_installs).toBe(20);
    expect(body.data.privacy).toMatchObject({
      ordered_by_occurred_at: true,
      minimum_release_installs: 20,
      minimum_transition_subscriptions: 20,
      small_release_cohorts_omitted: true,
      small_transition_segments_omitted: true,
    });
    expect(body.data.release_cohorts).toEqual([expect.objectContaining({
      build_number: '20', platform: 'ios', cohort_day: '2026-07-01',
      cohort_installations: 20, unique_installs: 1,
    })]);
    expect(body.data.authoritative_transitions).toEqual({
      trial_started: 0,
      paid_started: 1,
      by_day: [{
        day: '2026-07-02', phase: 'paid', transitions: 20, distinct_subscriptions: 20,
      }],
      by_provider_plan: [
        {
          provider: 'google', plan: 'yearly', phase: 'paid',
          transitions: 20, distinct_subscriptions: 20,
        },
        {
          provider: 'unknown', plan: 'unknown', phase: 'unknown',
          transitions: 20, distinct_subscriptions: 20,
        },
      ],
      source_of_truth: 'subscription_marketing_transitions',
    });
    expect(body.data.cohorts).toEqual([expect.objectContaining({ cohort_day: '2026-07-02', installs: 20 })]);
    expect(body.data.campaigns[0]).toMatchObject({
      campaign: 'android_first_launch', attributed_installs: null, attribution_suppressed: true,
      landing_views: null, paid_starts: null, cost_per_paid_start_cents: null,
    });
    expect(body.data.campaigns[1]).toMatchObject({ campaign: 'android_launch_br', attributed_installs: 20 });
    expect(body.data.campaigns[2]).toMatchObject({
      campaign: 'br_android_202608_prayer_words',
      attributed_installs: 0,
      attribution_suppressed: false,
      landing_views: 0,
      store_cta_clicks: 0,
      first_opens: 0,
      trial_starts: 0,
      paid_starts: 0,
      cost_per_first_open_cents: null,
      cost_per_trial_cents: null,
      cost_per_paid_start_cents: null,
    });
    expect(body.data.authoritative_subscriptions.by_provider_product).toEqual([
      { provider: 'google', product_id: 'vella.premium.yearly', subscriptions: 20, active_now: 20 },
    ]);
    for (const sentinel of privacySentinels) {
      expect(JSON.stringify(body)).not.toContain(sentinel);
    }
  });

  it('separates source-qualified, platform-blended, and not-attributable economics with mature CAC gates', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [],
      daily: [],
      cohorts: [],
      campaigns: [
        {
          source: 'google',
          campaign: 'vella_br_android_202608_prayerdaily',
          spend_cents: 120000,
          currency: 'BRL',
          attributed_installs: 20,
          attribution_suppressed: false,
          landing_views: 30,
          store_cta_clicks: 24,
          first_opens: 20,
          trial_starts: 8,
          paid_starts: 4,
          cost_per_first_open_cents: 6000,
          cost_per_trial_cents: 15000,
          cost_per_paid_start_cents: 30000,
        },
        {
          source: 'google',
          campaign: 'android_first_launch',
          spend_cents: 59409,
          currency: 'BRL',
          attributed_installs: 0,
          attribution_suppressed: false,
          landing_views: 0,
          store_cta_clicks: 0,
          first_opens: 0,
          trial_starts: 0,
          paid_starts: 0,
          cost_per_first_open_cents: null,
          cost_per_trial_cents: null,
          cost_per_paid_start_cents: null,
        },
      ],
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
    const sourceQualifiedMature = subscriptionAttributionRows(20, {}, 0);
    const sourceQualifiedRecent = subscriptionAttributionRows(20, {
      occurred_at: '2026-07-25T12:00:00.000Z',
    }, 100);
    const platformBlended = subscriptionAttributionRows(20, {
      attribution_scope: 'platform_blended',
      subscription_provider: 'apple',
      plan: 'monthly',
      platform: null,
      attribution_provider: null,
      source: null,
      medium: null,
      campaign: null,
      campaign_id: null,
    }, 200);
    const appleSourceQualified = subscriptionAttributionRows(20, {
      subscription_provider: 'apple',
      plan: 'monthly',
      platform: 'ios',
      attribution_provider: 'apple_ads',
      source: null,
      medium: null,
      campaign: null,
      campaign_id: 42,
    }, 300);
    const suppressedGoogleTrialSource = subscriptionAttributionRows(19, {
      phase: 'trial',
    }, 350);
    const invalidProviderPlatformMatch = subscriptionAttributionRows(1, {
      subscription_provider: 'apple',
      plan: 'monthly',
      platform: 'android',
      attribution_provider: 'apple_ads',
      source: null,
      medium: null,
      campaign: null,
      campaign_id: 42,
    }, 400);
    const { rpc, attributionBuilder } = mockGrowthRpcs(report, [
      ...sourceQualifiedMature,
      ...sourceQualifiedRecent,
      ...platformBlended,
      ...appleSourceQualified,
      ...suppressedGoogleTrialSource,
      ...invalidProviderPlatformMatch,
    ]);
    const matureSpendRows = [
      {
        spend_date: '2026-07-01', source: 'google',
        campaign: 'vella_br_android_202608_prayerdaily', currency: 'BRL', spend_cents: 60000,
      },
      {
        spend_date: '2026-07-02', source: 'google',
        campaign: 'vella_br_android_202608_prayerdaily', currency: 'BRL', spend_cents: 60000,
      },
      {
        spend_date: '2026-07-10', source: 'google',
        campaign: 'android_first_launch', currency: 'BRL', spend_cents: 59409,
      },
    ];
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({
        data: table === 'growth_campaign_spend_daily' ? matureSpendRows : [],
        error: null,
      });
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.campaigns[0].campaign).toBe('vella_br_android_202608_prayerdaily');
    expect(body.data.attribution_economics).toEqual({
      audit_available: true,
      spend_audit_available: true,
      row_limit_reached: false,
      spend_row_limit_reached: false,
      minimum_breakdown_transitions: 20,
      mature_after_days: 16,
      provisional_cac_ceiling_cents: 6000,
      source_qualified: [
        {
          attribution_label: 'source-qualified',
          subscription_provider: 'google',
          plan: 'yearly',
          phase: 'paid',
          platform: 'android',
          attribution_provider: 'play_install_referrer',
          source: 'google',
          medium: 'cpc',
          campaign: 'vella_br_android_202608_prayerdaily',
          apple_campaign_id: null,
          transitions: 40,
          mature_transitions: 20,
          maturity_suppressed: false,
        },
        {
          attribution_label: 'source-qualified',
          subscription_provider: 'apple',
          plan: 'monthly',
          phase: 'paid',
          platform: 'ios',
          attribution_provider: 'apple_ads',
          source: null,
          medium: null,
          campaign: null,
          apple_campaign_id: 42,
          transitions: 20,
          mature_transitions: 20,
          maturity_suppressed: false,
        },
      ],
      platform_blended: [{
        attribution_label: 'platform-blended',
        subscription_provider: 'apple',
        plan: 'monthly',
        phase: 'paid',
        transitions: 21,
        mature_transitions: 21,
        maturity_suppressed: false,
      }],
      campaign_economics: [{
        attribution_label: 'source-qualified',
        source: 'google',
        campaign: 'vella_br_android_202608_prayerdaily',
        paid_transitions: 40,
        mature_paid_transitions: 20,
        maturity_suppressed: false,
        mature_spend_cents: 120000,
        currency: 'BRL',
        mature_paid_cac_cents: 6000,
        provisional_cac_ceiling_cents: 6000,
        within_provisional_cac_ceiling: true,
        diagnostic_attributed_installs: 20,
        diagnostic_first_opens: 20,
        diagnostic_trial_starts: 8,
        diagnostic_paid_starts: 4,
      }],
      not_attributable_campaigns: [{
        attribution_label: 'not attributable',
        source: 'google',
        campaign: 'android_first_launch',
        spend_cents: 59409,
        currency: 'BRL',
        attributed_installs: 0,
        first_opens: 0,
        trial_starts: 0,
        paid_starts: 0,
      }],
    });
    expect(rpc).toHaveBeenCalledWith('growth_subscription_attribution_truth', {
      p_from: '2026-07-01T00:00:00.000Z',
      p_to: '2026-08-01T00:00:00.000Z',
    }, { count: 'exact' });
    expect(attributionBuilder.order).toHaveBeenNthCalledWith(1, 'occurred_at', { ascending: true });
    expect(attributionBuilder.order).toHaveBeenNthCalledWith(2, 'transition_id', { ascending: true });
    expect(attributionBuilder.range).toHaveBeenCalledWith(0, 999);
  });

  it('pages the complete spend ledger with an exact count and stable ordering', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const spendRows = Array.from({ length: 1001 }, (_, index) => ({
      spend_date: '2026-07-01',
      source: 'google',
      campaign: `ledger_${String(index).padStart(4, '0')}`,
      currency: 'BRL',
      spend_cents: 1,
    }));
    const { rpc } = mockGrowthRpcs(report);
    const { from, buildersByTable } = mockTableQueries((table) => ({
      data: table === 'growth_campaign_spend_daily' ? spendRows : [],
      error: null,
    }));
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics.spend_audit_available).toBe(true);
    const spendBuilders = buildersByTable.get('growth_campaign_spend_daily') ?? [];
    expect(spendBuilders).toHaveLength(2);
    expect(spendBuilders[0].select).toHaveBeenCalledWith(
      'spend_date,source,campaign,currency,spend_cents',
      { count: 'exact' },
    );
    for (const spendBuilder of spendBuilders) {
      expect(spendBuilder.order).toHaveBeenNthCalledWith(1, 'spend_date', { ascending: true });
      expect(spendBuilder.order).toHaveBeenNthCalledWith(2, 'source', { ascending: true });
      expect(spendBuilder.order).toHaveBeenNthCalledWith(3, 'campaign', { ascending: true });
      expect(spendBuilder.order).toHaveBeenNthCalledWith(4, 'currency', { ascending: true });
    }
    expect(spendBuilders[0].range).toHaveBeenCalledWith(0, 999);
    expect(spendBuilders[1].range).toHaveBeenCalledWith(1000, 1999);
  });

  it.each([
    {
      caseName: 'missing matching mature spend rows',
      spendRows: [] as Record<string, unknown>[],
      expectedSpend: null,
      expectedCac: null,
      expectedWithinCeiling: null,
    },
    {
      caseName: 'an explicit zero-cent mature spend row',
      spendRows: [{
        spend_date: '2026-07-01',
        source: 'google',
        campaign: 'vella_br_android_202608_prayerdaily',
        currency: 'BRL',
        spend_cents: 0,
      }],
      expectedSpend: 0,
      expectedCac: 0,
      expectedWithinCeiling: true,
    },
  ])('does not invent spend or discard zero for $caseName', async ({
    spendRows,
    expectedSpend,
    expectedCac,
    expectedWithinCeiling,
  }) => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { rpc } = mockGrowthRpcs(report, subscriptionAttributionRows(20, {}, 450));
    const { from } = mockTableQueries((table) => ({
      data: table === 'growth_campaign_spend_daily' ? spendRows : [],
      error: null,
    }));
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics.campaign_economics).toEqual([
      expect.objectContaining({
        mature_paid_transitions: 20,
        mature_spend_cents: expectedSpend,
        mature_paid_cac_cents: expectedCac,
        within_provisional_cac_ceiling: expectedWithinCeiling,
      }),
    ]);
  });

  it('uses no later than now for the exact 16-full-day maturity boundary', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-08-01', to: '2026-08-25', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const exactlyMature = subscriptionAttributionRows(20, {
      occurred_at: '2026-08-09T12:00:00.000Z',
    }, 500);
    const oneMillisecondTooRecent = subscriptionAttributionRows(1, {
      occurred_at: '2026-08-09T12:00:00.001Z',
    }, 550);
    const { rpc } = mockGrowthRpcs(report, [...exactlyMature, ...oneMillisecondTooRecent]);
    const { from } = mockTableQueries();
    mocks.createServiceClient.mockReturnValue({ rpc, from });
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-25T12:00:00.000Z'));

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-08-01&to=2026-08-25',
      { headers: headers() },
    ));

    dateNow.mockRestore();
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics.source_qualified).toEqual([
      expect.objectContaining({
        transitions: 21,
        mature_transitions: 20,
        maturity_suppressed: false,
      }),
    ]);
  });

  it('fails attribution reporting closed when service-only truth is unavailable', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const privacySentinels = adversarialPrivacySentinels();
    const hiddenError = privacySentinels.join('|');
    const { rpc } = mockGrowthRpcs(report, [], { code: hiddenError, message: hiddenError });
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => pagedQuery(limit));
    const gte = vi.fn(() => ({ lt }));
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ gte, eq }));
    const from = vi.fn(() => ({ select }));
    mocks.createServiceClient.mockReturnValue({ rpc, from });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics).toMatchObject({
      audit_available: false,
      source_qualified: [],
      platform_blended: [],
      campaign_economics: [],
      not_attributable_campaigns: [],
    });
    expect(consoleError).toHaveBeenCalledWith('[operator.growth] attribution_truth_unavailable', {
      rpcQueryFailed: true,
      rowLimitReached: false,
      malformedResult: false,
    });
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    consoleError.mockRestore();
  });

  it.each([
    {
      caseName: 'a malformed production transition row',
      rows: subscriptionAttributionRows(1, { phase: 'renewal' }, 500),
    },
    {
      caseName: 'a duplicated production transition ID',
      rows: (() => {
        const [row] = subscriptionAttributionRows(1, {}, 600);
        return [row, { ...row }];
      })(),
    },
  ])('fails attribution reporting closed for $caseName', async ({ rows }) => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { rpc } = mockGrowthRpcs(report, rows);
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => pagedQuery(limit));
    const gte = vi.fn(() => ({ lt }));
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ gte, eq }));
    const from = vi.fn(() => ({ select }));
    mocks.createServiceClient.mockReturnValue({ rpc, from });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics).toMatchObject({
      audit_available: false,
      source_qualified: [],
      platform_blended: [],
      campaign_economics: [],
      not_attributable_campaigns: [],
    });
    expect(consoleError).toHaveBeenCalledWith('[operator.growth] attribution_truth_unavailable', {
      rpcQueryFailed: false,
      rowLimitReached: false,
      malformedResult: true,
    });
    consoleError.mockRestore();
  });

  it('disables CAC instead of zero-filling a malformed spend-ledger result', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({
        data: table === 'growth_campaign_spend_daily'
          ? [{
              spend_date: 'not-a-date',
              source: 'google',
              campaign: 'vella_br_android_202608_prayerdaily',
              currency: 'BRL',
              spend_cents: 4600,
            }]
          : [],
        error: null,
      });
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.attribution_economics).toMatchObject({
      audit_available: true,
      spend_audit_available: false,
      campaign_economics: [],
    });
    expect(consoleError).toHaveBeenCalledWith('[operator.growth] attribution_spend_unavailable', {
      queryFailed: false,
      rowLimitReached: false,
      malformedResult: true,
    });
    consoleError.mockRestore();
  });

  it('renders truthful attribution labels, maturity suppression, and the provisional CAC ceiling', () => {
    const panel = (growthDashboardModule as Record<string, unknown>).AttributionEconomicsPanel;
    expect(typeof panel).toBe('function');
    const html = renderedText((panel as (props: Record<string, unknown>) => unknown)({
      economics: {
        audit_available: true,
        spend_audit_available: true,
        row_limit_reached: false,
        spend_row_limit_reached: false,
        minimum_breakdown_transitions: 20,
        mature_after_days: 16,
        provisional_cac_ceiling_cents: 6000,
        source_qualified: [],
        platform_blended: [{
          attribution_label: 'platform-blended',
          subscription_provider: 'apple',
          plan: 'monthly',
          phase: 'paid',
          transitions: 20,
          mature_transitions: null,
          maturity_suppressed: true,
        }],
        campaign_economics: [{
          attribution_label: 'source-qualified',
          source: 'google',
          campaign: 'vella_br_android_202608_prayerdaily',
          paid_transitions: 20,
          mature_paid_transitions: null,
          maturity_suppressed: true,
          mature_spend_cents: 4600,
          currency: 'BRL',
          mature_paid_cac_cents: null,
          provisional_cac_ceiling_cents: 6000,
          within_provisional_cac_ceiling: null,
          diagnostic_attributed_installs: 20,
          diagnostic_first_opens: 20,
          diagnostic_trial_starts: 2,
          diagnostic_paid_starts: 1,
        }],
        not_attributable_campaigns: [{
          attribution_label: 'not attributable',
          source: 'google',
          campaign: 'android_first_launch',
          spend_cents: 59409,
          currency: 'BRL',
          attributed_installs: 0,
          first_opens: 0,
          trial_starts: 0,
          paid_starts: 0,
        }],
      },
    })).replace(/\s+/g, ' ').trim();

    expect(html).toContain('source-qualified');
    expect(html).toContain('platform-blended');
    expect(html).toContain('not attributable');
    expect(html).toContain('16 full days');
    expect(html).toContain('R$60');
    expect(html).toContain('Immature / suppressed');
    expect(html).toContain('never means organic');
    expect(html).toContain('Paid campaigns remain paused');
  });

  it('renders missing mature spend separately from an immature cohort', () => {
    const panel = (growthDashboardModule as Record<string, unknown>).AttributionEconomicsPanel;
    expect(typeof panel).toBe('function');
    const html = renderedText((panel as (props: Record<string, unknown>) => unknown)({
      economics: {
        audit_available: true,
        spend_audit_available: true,
        row_limit_reached: false,
        spend_row_limit_reached: false,
        minimum_breakdown_transitions: 20,
        mature_after_days: 16,
        provisional_cac_ceiling_cents: 6000,
        source_qualified: [],
        platform_blended: [],
        campaign_economics: [{
          attribution_label: 'source-qualified',
          source: 'google',
          campaign: 'vella_br_android_202608_prayerdaily',
          paid_transitions: 20,
          mature_paid_transitions: 20,
          maturity_suppressed: false,
          mature_spend_cents: null,
          currency: 'BRL',
          mature_paid_cac_cents: null,
          provisional_cac_ceiling_cents: 6000,
          within_provisional_cac_ceiling: null,
          diagnostic_attributed_installs: 20,
          diagnostic_first_opens: 20,
          diagnostic_trial_starts: 2,
          diagnostic_paid_starts: 1,
        }],
        not_attributable_campaigns: [],
      },
    })).replace(/\s+/g, ' ').trim();

    expect(html).toContain('Missing ledger rows');
    expect(html).toContain('CAC unavailable');
    expect(html).toContain('Spend required');
  });

  it('fails closed when the required ordered summary blocks are unavailable', async () => {
    const report = {
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { from } = mockSummaryClient(report);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed instead of zero-filling a malformed authoritative transition block', async () => {
    const blocks = orderedReportBlocks() as Record<string, any>;
    blocks.authoritative_transitions.by_provider_plan = 'malformed';
    const report = {
      ...blocks,
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { from } = mockSummaryClient(report);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed instead of inventing a missing Vella profile acquisition metric', async () => {
    const blocks = orderedReportBlocks() as Record<string, any>;
    blocks.diagnostic_totals.vella_profile_initialized = {
      unique_installs: 1,
      event_count: -1,
      source_of_truth: 'vella_profile_initialized',
    };
    const report = {
      ...blocks,
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { from } = mockSummaryClient(report);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed when a release cohort lacks exact native platform/day privacy dimensions', async () => {
    const blocks = orderedReportBlocks() as Record<string, any>;
    blocks.release_cohorts = [{
      app_version: '2.0.0',
      build_number: '200',
      runtime_version: '2.0',
      platform: 'web',
      cohort_day: 'not-a-day',
      funnel_variant: 'compact_v2',
      event_name: 'first_open',
      stage_order: 1,
      cohort_installations: 20,
      unique_installs: 21,
    }];
    const report = {
      ...blocks,
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {}, privacy: {},
    };
    const { from } = mockSummaryClient(report);

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it('does not treat a regular authenticated bearer as an operator bypass', async () => {
    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: { authorization: 'Bearer shared-auth-session' } },
    ));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('strictly projects the documented RPC shape and drops every adversarial nested value', async () => {
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialValue = privacySentinels.join('|');
    const adversarialKey = privacySentinels[0];
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14, [adversarialKey]: adversarialValue },
      funnel: [
        { event_name: 'first_open', unique_installs: 3, event_count: 4 },
        { event_name: adversarialValue, unique_installs: -1, event_count: 1.5, [adversarialKey]: adversarialValue },
        adversarialValue,
      ],
      daily: [
        {
          day: '2026-07-01',
          unique_installs: 3,
          event_count: 4,
          first_open: 3,
          onboarding_completed: 2,
          account_created: 2,
          paywall_viewed: 1,
          trial_started: 1,
          subscription_paid_started: 0,
          meaningful_session_completed: 2,
          [adversarialKey]: adversarialValue,
        },
        {
          day: adversarialValue,
          unique_installs: Number.POSITIVE_INFINITY,
          event_count: -1,
          first_open: 1.5,
          onboarding_completed: Number.MAX_SAFE_INTEGER + 1,
          account_created: -2,
          paywall_viewed: Number.NaN,
          trial_started: -1,
          subscription_paid_started: 2.5,
          meaningful_session_completed: -1,
        },
      ],
      cohorts: [
        {
          cohort_day: '2026-07-01',
          installs: 20,
          onboarding_completed: 12,
          account_created: 10,
          trial_started: 4,
          subscription_paid_started: 2,
          activated_24h: 8,
          d1_retained: 7,
          d7_retained: 3,
        },
        {
          cohort_day: adversarialValue,
          installs: -1,
          onboarding_completed: 1.5,
          account_created: Number.POSITIVE_INFINITY,
          trial_started: -1,
          subscription_paid_started: Number.NaN,
          activated_24h: -1,
          d1_retained: 1.5,
          d7_retained: Number.MAX_SAFE_INTEGER + 1,
        },
      ],
      campaigns: [
        {
          source: 'google',
          campaign: 'android_launch_br',
          spend_cents: 1200,
          currency: 'BRL',
          attributed_installs: 20,
          attribution_suppressed: false,
          landing_views: 30,
          store_cta_clicks: 24,
          first_opens: 20,
          trial_starts: 4,
          paid_starts: 2,
          cost_per_first_open_cents: 60,
          cost_per_trial_cents: 300,
          cost_per_paid_start_cents: 600,
          [adversarialKey]: adversarialValue,
        },
        {
          source: adversarialValue,
          campaign: adversarialValue,
          spend_cents: -1,
          currency: adversarialValue,
          attributed_installs: 1.5,
          attribution_suppressed: adversarialValue,
          landing_views: -1,
          store_cta_clicks: Number.NaN,
          first_opens: Number.POSITIVE_INFINITY,
          trial_starts: -1,
          paid_starts: 2.5,
          cost_per_first_open_cents: -1,
          cost_per_trial_cents: 1.5,
          cost_per_paid_start_cents: Number.MAX_SAFE_INTEGER + 1,
        },
        adversarialValue,
      ],
      authoritative_subscriptions: {
        verified_starts: 4,
        active_now: 3,
        auto_renew_off_now: 1,
        ended_updates: 2,
        by_provider_product: [
          { provider: 'apple', product_id: adversarialValue, subscriptions: 2, active_now: 1 },
          {
            provider: adversarialValue,
            product_id: adversarialValue,
            subscriptions: -1,
            active_now: 1.5,
            [adversarialKey]: adversarialValue,
          },
          adversarialValue,
        ],
        source_of_truth: 'verified_store_subscriptions',
        [adversarialKey]: adversarialValue,
      },
      webhook_health: {
        received: 5,
        processed: 4,
        pending: 1,
        by_provider: [
          { provider: 'google', received: 3, processed: 2, pending: 1 },
          { provider: adversarialValue, received: -1, processed: 1.5, pending: Number.POSITIVE_INFINITY },
          adversarialValue,
        ],
        [adversarialKey]: adversarialValue,
      },
      privacy: {
        raw_retention_days: 90,
        minimum_breakdown_installs: 20,
        small_cohorts_omitted: true,
        small_campaign_metrics_suppressed: true,
        small_subscription_product_groups_omitted: true,
        contains_ip_or_raw_content: false,
        contains_account_identifier: false,
        client_subscription_events_are_authoritative: false,
        [adversarialKey]: adversarialValue,
      },
      [adversarialKey]: adversarialValue,
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => pagedQuery(limit));
    const gte = vi.fn(() => ({ lt }));
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ gte, eq }));
    const from = vi.fn(() => ({ select }));
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31&cohort_days=14',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.window).toEqual({ from: '2026-07-01', to: '2026-07-31', cohort_days: 14 });
    expect(body.data.funnel).toEqual([
      { event_name: 'first_open', unique_installs: 3, event_count: 4 },
      { event_name: 'unknown', unique_installs: 0, event_count: 0 },
    ]);
    expect(body.data.daily[0]).toMatchObject({ day: '2026-07-01', first_open: 3, event_count: 4 });
    expect(body.data.daily[1]).toEqual({
      day: 'unknown',
      unique_installs: 0,
      event_count: 0,
      first_open: 0,
      onboarding_completed: 0,
      account_created: 0,
      paywall_viewed: 0,
      trial_started: 0,
      subscription_paid_started: 0,
      meaningful_session_completed: 0,
    });
    expect(body.data.cohorts).toEqual([
      expect.objectContaining({ cohort_day: '2026-07-01', installs: 20, d7_retained: 3 }),
    ]);
    expect(body.data.campaigns[0]).toMatchObject({
      source: 'google',
      campaign: 'android_launch_br',
      spend_cents: 1200,
      currency: 'BRL',
    });
    expect(body.data.campaigns[1]).toEqual({
      source: 'unknown',
      campaign: 'unknown',
      spend_cents: 0,
      currency: 'unknown',
      attributed_installs: null,
      attribution_suppressed: false,
      landing_views: null,
      store_cta_clicks: null,
      first_opens: null,
      trial_starts: null,
      paid_starts: null,
      cost_per_first_open_cents: null,
      cost_per_trial_cents: null,
      cost_per_paid_start_cents: null,
    });
    expect(body.data.authoritative_subscriptions).toEqual({
      verified_starts: 4,
      active_now: 3,
      auto_renew_off_now: 1,
      ended_updates: 2,
      by_provider_product: [],
      source_of_truth: 'verified_store_subscriptions',
    });
    expect(body.data.webhook_health).toEqual({
      received: 5,
      processed: 4,
      pending: 1,
      by_provider: [
        { provider: 'google', received: 3, processed: 2, pending: 1 },
        { provider: 'unknown', received: 0, processed: 0, pending: 0 },
      ],
    });
    expect(body.data.privacy).toEqual({
      raw_retention_days: 90,
      minimum_breakdown_installs: 20,
      small_cohorts_omitted: true,
      small_campaign_metrics_suppressed: true,
      small_subscription_product_groups_omitted: true,
      contains_ip_or_raw_content: false,
      contains_account_identifier: false,
      client_subscription_events_are_authoritative: false,
      ordered_by_occurred_at: true,
      minimum_release_installs: 20,
      minimum_transition_subscriptions: 20,
      small_release_cohorts_omitted: true,
      small_transition_segments_omitted: true,
    });
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('counts only normalized lowercase 64-character hexadecimal fingerprints as distinct conflicts', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const repeatedProof = 'a'.repeat(64);
    const distinctProof = 'b'.repeat(64);
    const wrongLengthProof = 'c'.repeat(63);
    const nonHexProof = 'g'.repeat(64);
    const uppercaseProof = 'D'.repeat(64);
    const whitespaceWrappedProof = ` ${'e'.repeat(64)} `;
    const failureRows = [
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'android',
        retryable: false,
        proof_fingerprint: repeatedProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'android',
        retryable: false,
        proof_fingerprint: repeatedProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: distinctProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: '',
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: '   ',
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: wrongLengthProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: nonHexProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: uppercaseProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: whitespaceWrappedProof,
      },
      {
        error_code: 'subscription_already_linked',
        source: 'entitlement_sync',
        platform: 'ios',
        retryable: false,
        proof_fingerprint: 42,
      },
      {
        error_code: 'receipt_invalid',
        source: 'server_validation',
        platform: 'android',
        retryable: false,
        proof_fingerprint: repeatedProof,
      },
    ];
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let selectedColumns = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'failed_receipts' && selectedColumns.includes('proof_fingerprint')
          ? failureRows
          : [],
        error: null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn((columns: string) => {
        selectedColumns = columns;
        return { gte, eq };
      });
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { iap_diagnostics: Record<string, unknown> } };
    expect(body.data.iap_diagnostics).toMatchObject({
      conflict_attempts: 10,
      distinct_conflict_proofs: 2,
      repeated_conflict_attempts: 1,
      unfingerprinted_conflict_attempts: 7,
    });
    const serialized = JSON.stringify(body.data.iap_diagnostics);
    expect(serialized).not.toContain('proof_fingerprint');
    expect(serialized).not.toContain(repeatedProof);
    expect(serialized).not.toContain(distinctProof);
    expect(serialized).not.toContain(wrongLengthProof);
    expect(serialized).not.toContain(nonHexProof);
    expect(serialized).not.toContain(uppercaseProof);
    expect(serialized).not.toContain(whitespaceWrappedProof);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('marks IAP audit values unavailable when a diagnostics query fails without leaking proof data', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialErrorValue = privacySentinels.join('|');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({
        data: null,
        error: table === 'failed_receipts'
          ? {
              code: adversarialErrorValue,
              message: adversarialErrorValue,
              details: adversarialErrorValue,
              hint: adversarialErrorValue,
            }
          : null,
      });
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { iap_diagnostics: Record<string, unknown> } };
    expect(body.data.iap_diagnostics).toMatchObject({
      audit_available: false,
      client_events: 0,
      client_failures: 0,
      server_failures: 0,
      verified_receipts: 0,
      conflict_attempts: 0,
      distinct_conflict_proofs: 0,
      repeated_conflict_attempts: 0,
      unfingerprinted_conflict_attempts: 0,
      row_limit_reached: false,
    });
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    expect(serializedResponse).not.toContain('proof_fingerprint');
    expect(serializedLogs).toContain('iap_diagnostics_unavailable');
    expect(serializedLogs).not.toContain('proof_fingerprint');
    expect(consoleError).toHaveBeenCalledWith('[operator.growth] iap_diagnostics_unavailable', {
      clientQueryFailed: false,
      failureQueryFailed: true,
      receiptQueryFailed: false,
    });
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    consoleError.mockRestore();
  });

  it('maps every IAP breakdown dimension through closed privacy-safe buckets', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialDimension = privacySentinels.join('|');
    const rowsByTable: Record<string, unknown[]> = {
      iap_client_events: [
        {
          stage: 'validation',
          outcome: 'failed',
          error_code: 'validation_rejected',
          platform: 'ios',
          product_id: 'allowed-product-fixture',
        },
        {
          stage: adversarialDimension,
          outcome: adversarialDimension,
          error_code: adversarialDimension,
          platform: adversarialDimension,
          product_id: adversarialDimension,
        },
      ],
      failed_receipts: [
        {
          source: 'server_validation',
          error_code: 'receipt_invalid',
          platform: 'android',
          retryable: false,
          proof_fingerprint: null,
          product_id: 'allowed-product-fixture',
        },
        {
          source: adversarialDimension,
          error_code: adversarialDimension,
          platform: adversarialDimension,
          retryable: false,
          proof_fingerprint: null,
          product_id: adversarialDimension,
        },
      ],
      in_app_purchase_receipts: [
        { platform: 'ios', billing_phase: 'trial', product_id: 'allowed-product-fixture' },
        {
          platform: adversarialDimension,
          billing_phase: adversarialDimension,
          product_id: adversarialDimension,
        },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({ data: rowsByTable[table] ?? [], error: null });
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { iap_diagnostics: Record<string, unknown> } };
    expect(body.data.iap_diagnostics).toMatchObject({
      by_client_issue: [
        { key: 'unknown:unknown:unknown', count: 1 },
        { key: 'validation:failed:validation_rejected', count: 1 },
      ],
      by_server_error: [
        { key: 'server_validation:receipt_invalid', count: 1 },
        { key: 'unknown:unknown', count: 1 },
      ],
      by_verified_phase: [
        { key: 'ios:trial', count: 1 },
        { key: 'unknown:unknown', count: 1 },
      ],
    });
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('marks IAP aggregate counts as lower bounds at the 5,000-row query cap', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const repeatedProof = 'a'.repeat(64);
    const cappedFailureRows = Array.from({ length: 5000 }, () => ({
      error_code: 'subscription_already_linked',
      source: 'entitlement_sync',
      platform: 'android',
      retryable: false,
      proof_fingerprint: repeatedProof,
    }));
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({
        data: table === 'failed_receipts' ? cappedFailureRows : [],
        error: null,
      });
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { iap_diagnostics: Record<string, unknown> } };
    expect(body.data.iap_diagnostics).toMatchObject({
      audit_available: true,
      server_failures: 5000,
      conflict_attempts: 5000,
      distinct_conflict_proofs: 1,
      repeated_conflict_attempts: 4999,
      unfingerprinted_conflict_attempts: 0,
      row_limit_reached: true,
    });
    const serialized = JSON.stringify(body.data.iap_diagnostics);
    expect(serialized).not.toContain('proof_fingerprint');
    expect(serialized).not.toContain(repeatedProof);
  });

  it('maps every funnel and release dimension through closed privacy-safe buckets', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialDimension = privacySentinels.join('|');
    const safeRelease = { app_version: '1.2.0', build_number: '23', runtime_version: '1.2' };
    const unsafeRelease = {
      app_version: adversarialDimension,
      build_number: adversarialDimension,
      runtime_version: adversarialDimension,
    };
    const firstExperienceCohort = Array.from({ length: 20 }, (_, index) => ({
      installation_id: `first-experience-${index}`,
      platform: 'android',
      build_number: adversarialDimension,
      runtime_version: adversarialDimension,
      properties: {},
    }));
    const rowsByEvent: Record<string, unknown[]> = {
      onboarding_step: [
        { installation_id: 'step-safe', ...safeRelease, properties: { step_key: 'goal' } },
        { installation_id: 'step-minutes', ...safeRelease, properties: { step_key: 'minutes' } },
        { installation_id: 'step-unsafe', ...unsafeRelease, properties: { step_key: adversarialDimension } },
      ],
      onboarding_step_result: [
        {
          installation_id: 'result-safe',
          ...safeRelease,
          properties: { step_key: 'goal', result: 'continued', duration_bucket: '15_29s' },
        },
        {
          installation_id: 'result-unsafe',
          ...unsafeRelease,
          properties: {
            step_key: adversarialDimension,
            result: adversarialDimension,
            duration_bucket: adversarialDimension,
          },
        },
      ],
      onboarding_interaction: [
        {
          installation_id: 'interaction-safe',
          ...safeRelease,
          properties: { step_key: 'goal', action: 'selected', selection_count: 1 },
        },
        {
          installation_id: 'interaction-unsafe',
          ...unsafeRelease,
          properties: {
            step_key: adversarialDimension,
            action: adversarialDimension,
            selection_count: '1',
          },
        },
      ],
      onboarding_error: [
        {
          installation_id: 'error-safe',
          ...safeRelease,
          properties: { step_key: 'goal', stage: 'save_profile', error_code: 'persistence_failed' },
        },
        {
          installation_id: 'error-unsafe',
          ...unsafeRelease,
          properties: {
            step_key: adversarialDimension,
            stage: adversarialDimension,
            error_code: adversarialDimension,
          },
        },
      ],
      onboarding_completed: [
        {
          installation_id: 'completion-safe',
          ...safeRelease,
          properties: { duration_bucket: '30_59s', goal_count: 3, focus_count: 2 },
        },
        {
          installation_id: 'completion-unsafe',
          ...unsafeRelease,
          properties: { duration_bucket: adversarialDimension, goal_count: '3', focus_count: -1 },
        },
      ],
      route_resolved: [
        {
          installation_id: 'route-safe',
          ...safeRelease,
          properties: {
            destination: 'onboarding',
            onboarding_state: 'incomplete',
            auth_state: 'anonymous',
            subscription_state: 'unknown',
            load_time_bucket: 'under_500ms',
          },
        },
        {
          installation_id: 'route-unsafe',
          ...unsafeRelease,
          properties: {
            destination: adversarialDimension,
            onboarding_state: adversarialDimension,
            auth_state: adversarialDimension,
            subscription_state: adversarialDimension,
            load_time_bucket: adversarialDimension,
          },
        },
      ],
      first_open: [
        { installation_id: 'release-safe', ...safeRelease, properties: {} },
        { installation_id: 'release-unsafe', ...unsafeRelease, properties: {} },
      ],
      onboarding_started: [
        { installation_id: 'release-safe', ...safeRelease, properties: {} },
        { installation_id: 'release-unsafe', ...unsafeRelease, properties: {} },
      ],
      auth_started: [
        { installation_id: 'auth-start-safe', ...safeRelease, properties: { entry_point: 'post_onboarding' } },
        { installation_id: 'auth-start-unsafe', ...unsafeRelease, properties: { entry_point: adversarialDimension } },
      ],
      auth_attempt: [
        {
          installation_id: 'auth-attempt-safe',
          ...safeRelease,
          properties: { stage: 'credentials', mode: 'sign_up', method: 'email', outcome: 'succeeded' },
        },
        {
          installation_id: 'auth-attempt-unsafe',
          ...unsafeRelease,
          properties: {
            stage: adversarialDimension,
            mode: adversarialDimension,
            method: adversarialDimension,
            outcome: adversarialDimension,
          },
        },
      ],
      first_experience_viewed: firstExperienceCohort,
      first_experience_step: [],
      first_experience_completed: [],
      first_experience_error: [],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' ? rowsByEvent[eventName] ?? [] : [],
        error: null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn((column: string, value: string) => {
        if (column === 'event_name') eventName = value;
        return { gte };
      });
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.onboarding_steps).toEqual(expect.arrayContaining([
      { step_key: 'goal', unique_installs: 1, event_count: 1 },
      { step_key: 'minutes', unique_installs: 1, event_count: 1 },
      { step_key: 'unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.onboarding_step_results).toEqual(expect.arrayContaining([
      { key: 'goal:continued', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.onboarding_diagnostics.by_step_duration).toEqual(expect.arrayContaining([
      { key: 'goal:continued:15_29s', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.onboarding_diagnostics.by_interaction).toEqual(expect.arrayContaining([
      { key: 'goal:selected:1', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.onboarding_diagnostics.by_error).toEqual(expect.arrayContaining([
      { key: 'goal:save_profile:persistence_failed', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.onboarding_diagnostics.completion_profiles).toEqual(expect.arrayContaining([
      { key: '30_59s:3:2', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.routing_diagnostics.by_destination).toEqual(expect.arrayContaining([
      { key: 'onboarding:incomplete:anonymous:unknown', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.routing_diagnostics.by_load_time).toEqual(expect.arrayContaining([
      { key: 'onboarding:under_500ms', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.auth_diagnostics.by_entry_point).toEqual(expect.arrayContaining([
      { key: 'post_onboarding', unique_installs: 1, event_count: 1 },
      { key: 'unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.auth_diagnostics.by_attempt).toEqual(expect.arrayContaining([
      { key: 'credentials:sign_up:email:succeeded', unique_installs: 1, event_count: 1 },
      { key: 'unknown:unknown:unknown:unknown', unique_installs: 1, event_count: 1 },
    ]));
    expect(body.data.release_funnel).toEqual([]);
    expect(body.data.first_experience_diagnostics.releases).toEqual([{
      platform: 'android',
      build_number: 'unknown',
      runtime_version: 'unknown',
      viewed_installs: 20,
      completed_installs: 0,
      error_installs: 0,
    }]);
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('suppresses first-experience breakdowns below 20 installs and limits completions to the viewed cohort', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const retainedCohort = Array.from({ length: 20 }, (_, index) => `retained-${index}`);
    const suppressedCohort = Array.from({ length: 19 }, (_, index) => `suppressed-${index}`);
    const completedWithoutView = Array.from({ length: 20 }, (_, index) => `outside-${index}`);
    const release22 = { platform: 'android', build_number: '22', runtime_version: '1.1.0' };
    const release23 = { platform: 'ios', build_number: '23', runtime_version: '1.1.0' };
    const rowsByEvent: Record<string, unknown[]> = {
      first_experience_viewed: [
        ...retainedCohort.map((installation_id) => ({ installation_id, ...release22, properties: {} })),
        ...suppressedCohort.map((installation_id) => ({ installation_id, ...release23, properties: {} })),
      ],
      first_experience_step: [
        ...retainedCohort.map((installation_id) => ({ installation_id, ...release22, properties: { step_key: 'arrival' } })),
        { installation_id: retainedCohort[0], ...release22, properties: { step_key: 'arrival' } },
        ...suppressedCohort.map((installation_id) => ({ installation_id, ...release23, properties: { step_key: 'scripture' } })),
        ...retainedCohort.map((installation_id) => ({ installation_id, ...release22, properties: { step_key: 'legacy_private_text' } })),
      ],
      first_experience_completed: [
        ...retainedCohort.map((installation_id) => ({ installation_id, ...release22, properties: {} })),
        ...completedWithoutView.map((installation_id) => ({ installation_id, ...release23, properties: {} })),
      ],
      first_experience_error: [
        ...retainedCohort.map((installation_id) => ({ installation_id, ...release22, properties: {} })),
      ],
    };
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' ? rowsByEvent[eventName] ?? [] : [],
        error: null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn((column: string, value: string) => {
        if (column === 'event_name') eventName = value;
        return { gte };
      });
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { first_experience_diagnostics: unknown } };
    expect(body.data.first_experience_diagnostics).toEqual({
      viewed_installs: 39,
      completed_installs: 20,
      error_installs: 20,
      completion_rate: 20 / 39,
      steps: [
        { step_key: 'arrival', installs: 20, events: 21 },
      ],
      releases: [
        {
          platform: 'android',
          build_number: '22',
          runtime_version: '1.1.0',
          viewed_installs: 20,
          completed_installs: 20,
          error_installs: 20,
        },
      ],
    });
    expect(JSON.stringify(body.data.first_experience_diagnostics)).not.toContain('installation_id');
    expect(JSON.stringify(body.data.first_experience_diagnostics)).not.toContain('properties');
    expect(JSON.stringify(body.data.first_experience_diagnostics)).not.toContain('legacy_private_text');
  });

  it('reports a null first-experience completion rate when no viewed cohort exists', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const completedRows = Array.from({ length: 20 }, (_, index) => ({
      installation_id: `completed-without-view-${index}`,
      platform: 'android',
      build_number: '22',
      runtime_version: '1.1.0',
      properties: {},
    }));
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' && eventName === 'first_experience_completed'
          ? completedRows
          : [],
        error: null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn((column: string, value: string) => {
        if (column === 'event_name') eventName = value;
        return { gte };
      });
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { first_experience_diagnostics: unknown } };
    expect(body.data.first_experience_diagnostics).toEqual({
      viewed_installs: 0,
      completed_installs: 0,
      error_installs: 0,
      completion_rate: null,
      steps: [],
      releases: [],
    });
  });

  it('returns a coarse failure when a first-experience query is unavailable', async () => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: [],
        error: table === 'growth_analytics_events' && eventName === 'first_experience_viewed'
          ? { code: 'query_failed', message: 'do-not-return' }
          : null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn((column: string, value: string) => {
        if (column === 'event_name') eventName = value;
        return { gte };
      });
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: { code: 'growth_report_unavailable' } },
    });
  });

  it.each([
    {
      failedEventName: 'onboarding_step',
      expectedFlags: {
        onboardingStepQueryFailed: true,
        onboardingStepResultQueryFailed: false,
        onboardingInteractionQueryFailed: false,
        onboardingErrorQueryFailed: false,
        onboardingCompletedQueryFailed: false,
        routeResolvedQueryFailed: false,
        firstOpenQueryFailed: false,
        onboardingStartedQueryFailed: false,
        authStartedQueryFailed: false,
        authAttemptQueryFailed: false,
      },
    },
    {
      failedEventName: 'first_open',
      expectedFlags: {
        onboardingStepQueryFailed: false,
        onboardingStepResultQueryFailed: false,
        onboardingInteractionQueryFailed: false,
        onboardingErrorQueryFailed: false,
        onboardingCompletedQueryFailed: false,
        routeResolvedQueryFailed: false,
        firstOpenQueryFailed: true,
        onboardingStartedQueryFailed: false,
        authStartedQueryFailed: false,
        authAttemptQueryFailed: false,
      },
    },
    {
      failedEventName: 'onboarding_started',
      expectedFlags: {
        onboardingStepQueryFailed: false,
        onboardingStepResultQueryFailed: false,
        onboardingInteractionQueryFailed: false,
        onboardingErrorQueryFailed: false,
        onboardingCompletedQueryFailed: false,
        routeResolvedQueryFailed: false,
        firstOpenQueryFailed: false,
        onboardingStartedQueryFailed: true,
        authStartedQueryFailed: false,
        authAttemptQueryFailed: false,
      },
    },
  ])('logs $failedEventName query failure with fixed booleans and never echoes database error fields', async ({
    failedEventName,
    expectedFlags,
  }) => {
    const report = {
      ...orderedReportBlocks(),
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialErrorValue = privacySentinels.join('|');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rpc } = mockGrowthRpcs(report);
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: [],
        error: table === 'growth_analytics_events' && eventName === failedEventName
          ? {
              code: adversarialErrorValue,
              message: adversarialErrorValue,
              details: adversarialErrorValue,
              hint: adversarialErrorValue,
            }
          : null,
      }));
      const lt = vi.fn(() => pagedQuery(limit));
      const gte = vi.fn(() => ({ lt }));
      const eq = vi.fn((column: string, value: string) => {
        if (column === 'event_name') eventName = value;
        return { gte };
      });
      const select = vi.fn(() => ({ gte, eq }));
      return { select };
    });
    mocks.createServiceClient.mockReturnValue({ rpc, from });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { onboarding_diagnostics: Record<string, unknown> } };
    expect(body.data.onboarding_diagnostics.audit_available).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      '[operator.growth] funnel_diagnostics_unavailable',
      expectedFlags,
    );
    const serializedResponse = JSON.stringify(body);
    const serializedLogs = JSON.stringify(consoleError.mock.calls);
    for (const sentinel of privacySentinels) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    consoleError.mockRestore();
  });

  it('rejects invalid and oversized report windows before querying', async () => {
    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-01-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('normalizes, deduplicates, and idempotently upserts daily BRL spend', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    mocks.createServiceClient.mockReturnValue({ from });
    const item = {
      date: '2026-07-31',
      source: 'Google',
      campaign: 'Launch_BR',
      currency: 'BRL',
      spend_cents: 12345,
    };

    const response = await saveSpend(new Request(
      'https://vella.one/api/v1/operator/growth/spend',
      {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item, { ...item, spend_cents: 15000 }] }),
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { saved: 1 } });
    expect(from).toHaveBeenCalledWith('growth_campaign_spend_daily');
    expect(upsert).toHaveBeenCalledWith([{
      spend_date: '2026-07-31',
      source: 'google',
      campaign: 'launch_br',
      currency: 'BRL',
      spend_cents: 15000,
    }], { onConflict: 'spend_date,source,campaign,currency' });
  });

  it('rejects non-BRL, arbitrary fields, and unauthenticated spend writes', async () => {
    const invalid = await saveSpend(new Request(
      'https://vella.one/api/v1/operator/growth/spend',
      {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{
          date: '2026-07-31',
          source: 'google',
          campaign: 'launch',
          currency: 'USD',
          spend_cents: 100,
          note: 'must not be stored',
        }] }),
      },
    ));
    expect(invalid.status).toBe(400);

    const unauthorized = await saveSpend(new Request(
      'https://vella.one/api/v1/operator/growth/spend',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      },
    ));
    expect(unauthorized.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('returns count-only Rhythms funnels from product truth and privacy-thresholded analytics cohorts', async () => {
    const privateInstall = '11111111-1111-4111-8111-111111111111';
    const privateAccount = '22222222-2222-4222-8222-222222222222';
    const privateContent = 'private devotional reflection';
    const releaseRows = (count: number, appVersion: string, buildNumber: string, runtimeVersion: string) =>
      Array.from({ length: count }, (_, index) => ({
        installation_id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
        event_name: 'rhythms_hub_viewed',
        platform: 'android',
        app_version: appVersion,
        build_number: buildNumber,
        runtime_version: runtimeVersion,
        properties: index === 0 ? { reflection_text: privateContent } : {},
      }));
    const analyticsRows = [
      ...releaseRows(20, '2.0.0', '200', '2.0'),
      ...releaseRows(19, '1.9.0', '190', '1.9'),
      {
        installation_id: privateInstall,
        event_name: 'journey_catalog_viewed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'journey_detail_viewed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'practice_catalog_viewed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'gathering_viewed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'milestone_revealed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'session_completion_conflict',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0', properties: {},
      },
      {
        installation_id: privateInstall,
        event_name: 'rhythms_mutation_failed',
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0',
        properties: { error_stage: 'session_complete', error_code: 'server_unavailable' },
      },
    ].map((row, index) => ({
      ...row,
      event_id: `60000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      received_at: new Date(Date.UTC(2026, 6, 1) + index * 1000).toISOString(),
    }));
    const tableRows: Record<string, unknown[]> = {
      growth_analytics_events: analyticsRows,
      user_journeys: [
        { id: '30000000-0000-4000-8000-000000000001', created_at: '2026-07-02T00:00:00Z', completed_at: null },
        { id: '30000000-0000-4000-8000-000000000002', created_at: '2026-07-03T00:00:00Z', completed_at: '2026-07-20T00:00:00Z' },
      ],
      user_journey_daily_sessions: [
        { id: '31000000-0000-4000-8000-000000000001', day_number: 1, completed_at: '2026-07-04T00:00:00Z' },
        { id: '31000000-0000-4000-8000-000000000002', day_number: 1, completed_at: '2026-07-05T00:00:00Z' },
      ],
      user_practices: [
        { id: '32000000-0000-4000-8000-000000000001', created_at: '2026-07-02T00:00:00Z' },
      ],
      practice_sessions: [
        {
          id: '33000000-0000-4000-8000-000000000001', user_id: privateAccount,
          practice_code: 'scripture', local_week_start: '2026-07-06',
          completed_at: '2026-07-07T00:00:00Z', status: 'completed',
        },
        {
          id: '33000000-0000-4000-8000-000000000002', user_id: privateAccount,
          practice_code: 'scripture', local_week_start: '2026-07-06',
          completed_at: '2026-07-08T00:00:00Z', status: 'completed',
        },
      ],
      user_gathering_progress: [
        {
          id: '34000000-0000-4000-8000-000000000001', started_at: '2026-07-09T00:00:00Z',
          completed_at: '2026-07-10T00:00:00Z', status: 'completed',
        },
      ],
      user_milestones: [
        { id: '35000000-0000-4000-8000-000000000001', earned_at: '2026-07-11T00:00:00Z' },
      ],
      user_featured_milestones: [
        { id: '36000000-0000-4000-8000-000000000001', created_at: '2026-07-12T00:00:00Z' },
      ],
    };
    mockRhythmsOperatorClient((query) => {
      const eventName = query.filters.find((filter) =>
        filter.method === 'eq' && filter.column === 'event_name')?.value;
      const isRhythmsAnalytics = query.table === 'growth_analytics_events' && typeof eventName === 'string' &&
        /^(?:rhythms_|journey_|practice_|weekly_|gathering_|milestone_|session_completion_)/.test(eventName);
      const dateColumn = query.filters.find((filter) => filter.method === 'gte')?.column;
      const isServerErrorCount = query.filters.some((filter) =>
        filter.method === 'eq' && filter.column === 'properties->>error_code');
      const rows = isServerErrorCount
        ? analyticsRows.filter((row) => 'error_code' in row.properties &&
          row.properties.error_code === 'server_unavailable')
        : isRhythmsAnalytics
          ? analyticsRows.filter((row) => row.event_name === eventName)
          : tableRows[query.table] ?? [];
      return {
        data: typeof dateColumn === 'string'
          ? rows.filter((row) => typeof (row as Record<string, unknown>)[dateColumn] === 'string')
          : rows,
        error: null,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({
      audit_available: true,
      source_of_truth: {
        discovery_and_presentation: 'growth_analytics_events',
        completions_and_awards: 'rhythms_product_tables',
      },
      journey_funnel: {
        hub_views: 39,
        catalog_views: 1,
        detail_views: 1,
        starts: 2,
        first_session_completions: 2,
        journey_completions: 1,
      },
      practice: { catalog_views: 1, weekly_rhythms_saved: 1, session_completions: 2 },
      gathering: { views: 1, starts: 1, completions: 1 },
      milestones: { earned: 1, revealed: 1, featured: 1 },
      failures: { idempotency_conflicts: 1, server_errors: 1 },
      cohorts: {
        minimum_installations: 20,
        releases: [{ app_version: '2.0.0', installations: 21, event_count: 27 }],
        runtimes: [{ runtime_version: '2.0', installations: 21, event_count: 27 }],
        builds: [{ build_number: '200', installations: 21, event_count: 27 }],
      },
    });
    const serialized = JSON.stringify(body.data.rhythms_diagnostics);
    for (const forbidden of [privateInstall, privateAccount, privateContent, 'installation_id', 'user_id', 'properties']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('counts only server_unavailable failures through a property-free server-side count query', async () => {
    const failures = ['server_unavailable', 'network_unavailable', 'conflict', 'server_unavailable']
      .map((errorCode, index) => ({
        event_id: `61000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        installation_id: `62000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        event_name: index % 2 === 0 ? 'rhythms_load_failed' : 'rhythms_mutation_failed',
        received_at: new Date(Date.UTC(2026, 6, 1) + index * 1000).toISOString(),
        platform: 'android', app_version: '2.0.0', build_number: '200', runtime_version: '2.0',
        properties: { error_stage: 'summary_load', error_code: errorCode },
      }));
    const { queries } = mockRhythmsOperatorClient((query) => {
      if (query.table !== 'growth_analytics_events') return { data: [], error: null };
      const isServerErrorCount = query.filters.some((filter) =>
        filter.method === 'eq' && filter.column === 'properties->>error_code');
      return {
        data: isServerErrorCount
          ? failures.filter((row) => row.properties.error_code === 'server_unavailable')
          : failures,
        error: null,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics.failures.server_errors).toBe(2);
    const countQuery = queries.find((query) => query.filters.some((filter) =>
      filter.method === 'eq' && filter.column === 'properties->>error_code'));
    expect(countQuery?.filters).toEqual(expect.arrayContaining([
      { method: 'eq', column: 'properties->>error_code', value: 'server_unavailable' },
      { method: 'in', column: 'event_name', value: ['rhythms_load_failed', 'rhythms_mutation_failed'] },
    ]));
    expect(countQuery?.selection?.columns).not.toContain('properties');
  });

  it('returns only unavailable Rhythms status on any audit query failure without raw error leakage', async () => {
    const rawError = 'database row 11111111-1111-4111-8111-111111111111 failed';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRhythmsOperatorClient((query) => ({
      data: [],
      error: query.table === 'practice_sessions' ? { message: rawError, details: rawError } : null,
    }));

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({ audit_available: false });
    expect(JSON.stringify(body)).not.toContain(rawError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(rawError);
    consoleError.mockRestore();
  });

  it('uses exact-count deterministic pagination through the Data API 1,000-row cap', async () => {
    const analyticsRows = pagedRhythmsAnalyticsRows(1200);
    const { queries } = mockRhythmsOperatorClient((query) => {
      const isMainAnalytics = query.table === 'growth_analytics_events' &&
        query.selection?.columns.includes('installation_id');
      const keysetFilters = query.filters.filter((filter) => filter.method === 'or');
      return {
        data: isMainAnalytics
          ? keysetFilters.length >= 2 ? analyticsRows.slice(1000) : analyticsRows
          : [],
        error: null,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics.journey_funnel.hub_views).toBe(1200);

    const boundary = queries.find((query) => query.table === 'growth_analytics_events' && query.limit === 1 &&
      query.selection?.columns.includes('installation_id'));
    expect(boundary?.selection?.options).toEqual({ count: 'exact' });
    expect(boundary?.filters).toEqual(expect.arrayContaining([
      { method: 'order', column: 'received_at', value: { ascending: false } },
      { method: 'order', column: 'event_id', value: { ascending: false } },
      { method: 'gte', column: 'received_at', value: '2026-07-01T00:00:00.000Z' },
      { method: 'lt', column: 'received_at', value: '2026-08-01T00:00:00.000Z' },
    ]));
    const pages = queries.filter((query) => query.table === 'growth_analytics_events' && query.limit === 1000 &&
      query.selection?.columns.includes('installation_id'));
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.selection?.options).toBeUndefined();
      expect(page.range).toBeUndefined();
      expect(page.filters).toEqual(expect.arrayContaining([
        { method: 'order', column: 'received_at', value: { ascending: true } },
        { method: 'order', column: 'event_id', value: { ascending: true } },
        { method: 'gte', column: 'received_at', value: '2026-07-01T00:00:00.000Z' },
        { method: 'lt', column: 'received_at', value: '2026-08-01T00:00:00.000Z' },
      ]));
    }
  });

  it('never silently replaces a frozen-set row during a same-count offset shift', async () => {
    const originalRows = pagedRhythmsAnalyticsRows(1200);
    originalRows[1000] = { ...originalRows[1000], event_name: 'journey_catalog_viewed' };
    const insertedAfterOriginalSet = {
      ...pagedRhythmsAnalyticsRows(1201)[1200],
      received_at: '2026-07-31T23:59:59.000Z',
    };
    const shiftedRows = [
      ...originalRows.slice(0, 500),
      ...originalRows.slice(501),
      insertedAfterOriginalSet,
    ];
    mockRhythmsOperatorClient((query) => {
      const isMainAnalytics = query.table === 'growth_analytics_events' &&
        query.selection?.columns.includes('installation_id');
      if (!isMainAnalytics) return { data: [], error: null, count: 0 };
      if (query.range?.[0] === 0) return { data: originalRows, error: null, count: 1200 };
      if (query.range?.[0] === 1000) return { data: shiftedRows, error: null, count: 1200 };
      const descendingBoundary = query.filters.some((filter) => filter.method === 'order' &&
        filter.column === 'received_at' &&
        (filter.value as { ascending?: boolean }).ascending === false);
      if (descendingBoundary) {
        return { data: originalRows, error: null, count: 1200 };
      }
      const keysetFilters = query.filters.filter((filter) => filter.method === 'or');
      return {
        data: keysetFilters.length >= 2 ? originalRows.slice(1000) : originalRows,
        error: null,
        count: 1200,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    const diagnostics = body.data.rhythms_diagnostics;
    if (diagnostics.audit_available) {
      expect(diagnostics.journey_funnel.hub_views).toBe(1199);
      expect(diagnostics.journey_funnel.catalog_views).toBe(1);
    } else {
      expect(diagnostics).toEqual({ audit_available: false });
    }
  });

  it('uses the stable UUID as the keyset tie-breaker for equal timestamps', async () => {
    const equalTimestampRows = pagedRhythmsAnalyticsRows(1002).map((row) => ({
      ...row,
      received_at: '2026-07-15T12:00:00.000Z',
    }));
    const { queries } = mockRhythmsOperatorClient((query) => {
      const isMainAnalytics = query.table === 'growth_analytics_events' &&
        query.selection?.columns.includes('installation_id');
      if (!isMainAnalytics) return { data: [], error: null, count: 0 };
      const descendingBoundary = query.filters.some((filter) => filter.method === 'order' &&
        filter.column === 'received_at' &&
        (filter.value as { ascending?: boolean }).ascending === false);
      if (descendingBoundary) {
        return { data: equalTimestampRows, error: null, count: 1002 };
      }
      const keysetFilters = query.filters.filter((filter) => filter.method === 'or');
      return {
        data: keysetFilters.length >= 2 ? equalTimestampRows.slice(1000) : equalTimestampRows,
        error: null,
        count: 1002,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics.journey_funnel.hub_views).toBe(1002);
    const secondPage = queries.find((query) => query.table === 'growth_analytics_events' &&
      query.selection?.columns.includes('installation_id') &&
      query.filters.filter((filter) => filter.method === 'or').length === 2);
    expect(secondPage).toBeDefined();
    expect(secondPage?.filters ?? []).toContainEqual({
      method: 'or',
      column: '',
      value: expect.stringContaining(`event_id.gt.${equalTimestampRows[999].event_id}`),
    });
  });

  it('accepts valid Rhythms analytics rows with optional build and runtime dimensions absent', async () => {
    const analyticsRows = [{
      ...pagedRhythmsAnalyticsRows(1)[0],
      build_number: null,
      runtime_version: null,
    }];
    mockRhythmsOperatorClient((query) => ({
      data: query.table === 'growth_analytics_events' &&
        query.selection?.columns.includes('installation_id') ? analyticsRows : [],
      error: null,
    }));

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics.journey_funnel.hub_views).toBe(1);
  });

  it.each([
    ['over-cap exact count', 5001, 5001, null],
    ['missing exact count', 1, null, null],
    ['missing final page rows', 1200, 1200, 1100],
  ] as const)('fails closed for %s', async (_label, rowCount, exactCount, returnedRows) => {
    const analyticsRows = pagedRhythmsAnalyticsRows(rowCount);
    mockRhythmsOperatorClient((query) => ({
      data: query.table === 'growth_analytics_events'
        ? analyticsRows.slice(0, returnedRows ?? analyticsRows.length)
        : [],
      error: null,
      count: query.table === 'growth_analytics_events' ? exactCount : 0,
    }));

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({ audit_available: false });
  });

  it('fails closed when a frozen row disappears before collection completes', async () => {
    const analyticsRows = pagedRhythmsAnalyticsRows(1200);
    mockRhythmsOperatorClient((query) => {
      if (query.table !== 'growth_analytics_events') return { data: [], error: null, count: 0 };
      const descendingBoundary = query.filters.some((filter) => filter.method === 'order' &&
        filter.column === 'received_at' &&
        (filter.value as { ascending?: boolean }).ascending === false);
      if (descendingBoundary) return { data: analyticsRows, error: null, count: 1200 };
      const keysetFilters = query.filters.filter((filter) => filter.method === 'or');
      return {
        data: keysetFilters.length >= 2 ? analyticsRows.slice(1000, 1199) : analyticsRows,
        error: null,
      };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({ audit_available: false });
  });

  it.each([
    ['malformed row', (rows: ReturnType<typeof pagedRhythmsAnalyticsRows>) => [
      ...rows.slice(0, 1),
      { ...rows[1], received_at: 'not-a-timestamp' },
    ]],
    ['duplicate page row', (rows: ReturnType<typeof pagedRhythmsAnalyticsRows>) => [
      ...rows.slice(0, 1000),
      ...rows.slice(0, 200),
    ]],
  ] as const)('fails closed for a %s', async (_label, mutate) => {
    const baseRows = pagedRhythmsAnalyticsRows(1200);
    const analyticsRows = mutate(baseRows);
    mockRhythmsOperatorClient((query) => ({
      data: query.table === 'growth_analytics_events' ? analyticsRows : [],
      error: null,
      count: query.table === 'growth_analytics_events' ? analyticsRows.length : 0,
    }));

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({ audit_available: false });
  });

  it('fails closed when an audit query promise rejects without logging the rejection', async () => {
    const rawError = 'rejected private row 11111111-1111-4111-8111-111111111111';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRhythmsOperatorClient(async (query) => {
      if (query.table === 'practice_sessions') throw new Error(rawError);
      return { data: [], error: null };
    });

    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, any> };
    expect(body.data.rhythms_diagnostics).toEqual({ audit_available: false });
    expect(JSON.stringify(body)).not.toContain(rawError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(rawError);
    consoleError.mockRestore();
  });

  it('date-bounds every Rhythms audit query to the explicit inclusive report window', async () => {
    const { queries } = mockRhythmsOperatorClient(() => ({ data: [], error: null }));
    const response = await getSummary(new Request(
      'https://vella.one/api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31',
      { headers: headers() },
    ));
    expect(response.status).toBe(200);
    const rhythmsTables = new Set([
      'growth_analytics_events', 'user_journeys', 'user_journey_daily_sessions', 'user_practices',
      'practice_sessions', 'user_gathering_progress', 'user_milestones', 'user_featured_milestones',
    ]);
    const rhythmsQueries = queries.filter((query) => rhythmsTables.has(query.table) && (
      query.table !== 'growth_analytics_events' ||
      query.filters.some((filter) => filter.column === 'event_name' && (
        filter.method === 'in' || filter.method === 'eq' && typeof filter.value === 'string' &&
        /^(?:rhythms_|journey_|practice_|weekly_|gathering_|milestone_|session_completion_)/.test(filter.value)
      ))
    ));
    expect(rhythmsQueries.length).toBeGreaterThanOrEqual(8);
    for (const query of rhythmsQueries) {
      expect(query.filters).toEqual(expect.arrayContaining([
        expect.objectContaining({ method: 'gte', value: '2026-07-01T00:00:00.000Z' }),
        expect.objectContaining({ method: 'lt', value: '2026-08-01T00:00:00.000Z' }),
      ]));
    }
  });
});
