import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET as getSummary } from '@/app/api/v1/operator/growth/summary/route';
import { POST as saveSpend } from '@/app/api/v1/operator/growth/spend/route';

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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => ({ limit }));
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
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ data: {
      ...report,
      onboarding_steps: [],
      onboarding_step_results: [],
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
        row_limit_reached: false,
      },
    } });
    expect(rpc).toHaveBeenCalledWith('growth_analytics_summary', {
      p_from: '2026-07-01',
      p_to: '2026-07-31',
      p_cohort_days: 14,
    });
    expect(from).toHaveBeenCalledTimes(17);
  });

  it('strictly projects the documented RPC shape and drops every adversarial nested value', async () => {
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialValue = privacySentinels.join('|');
    const adversarialKey = privacySentinels[0];
    const report = {
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const lt = vi.fn(() => ({ limit }));
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
    expect(body.data.cohorts[0]).toMatchObject({ cohort_day: '2026-07-01', installs: 20, d7_retained: 3 });
    expect(body.data.cohorts[1]).toMatchObject({ cohort_day: 'unknown', installs: 0, d7_retained: 0 });
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
      by_provider_product: [
        { provider: 'apple', product_id: 'unknown', subscriptions: 2, active_now: 1 },
        { provider: 'unknown', product_id: 'unknown', subscriptions: 0, active_now: 0 },
      ],
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      let selectedColumns = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'failed_receipts' && selectedColumns.includes('proof_fingerprint')
          ? failureRows
          : [],
        error: null,
      }));
      const lt = vi.fn(() => ({ limit }));
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
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialErrorValue = privacySentinels.join('|');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
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
      const lt = vi.fn(() => ({ limit }));
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({ data: rowsByTable[table] ?? [], error: null });
      const lt = vi.fn(() => ({ limit }));
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      const limit = vi.fn().mockResolvedValue({
        data: table === 'failed_receipts' ? cappedFailureRows : [],
        error: null,
      });
      const lt = vi.fn(() => ({ limit }));
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' ? rowsByEvent[eventName] ?? [] : [],
        error: null,
      }));
      const lt = vi.fn(() => ({ limit }));
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
    expect(body.data.release_funnel).toEqual(expect.arrayContaining([
      {
        app_version: '1.2.0',
        build_number: '23',
        runtime_version: '1.2',
        first_open: 1,
        onboarding_started: 1,
        onboarding_completed: 1,
      },
      {
        app_version: 'unknown',
        build_number: 'unknown',
        runtime_version: 'unknown',
        first_open: 1,
        onboarding_started: 1,
        onboarding_completed: 1,
      },
    ]));
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' ? rowsByEvent[eventName] ?? [] : [],
        error: null,
      }));
      const lt = vi.fn(() => ({ limit }));
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
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: table === 'growth_analytics_events' && eventName === 'first_experience_completed'
          ? completedRows
          : [],
        error: null,
      }));
      const lt = vi.fn(() => ({ limit }));
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
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const from = vi.fn((table: string) => {
      let eventName = '';
      const limit = vi.fn().mockImplementation(() => Promise.resolve({
        data: [],
        error: table === 'growth_analytics_events' && eventName === 'first_experience_viewed'
          ? { code: 'query_failed', message: 'do-not-return' }
          : null,
      }));
      const lt = vi.fn(() => ({ limit }));
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
      window: { from: '2026-07-01', to: '2026-07-31', cohort_days: 14 },
      funnel: [], daily: [], cohorts: [], campaigns: [],
      authoritative_subscriptions: { source_of_truth: 'verified_store_subscriptions' },
      webhook_health: {},
      privacy: { minimum_breakdown_installs: 20, contains_account_identifier: false },
    };
    const privacySentinels = adversarialPrivacySentinels();
    const adversarialErrorValue = privacySentinels.join('|');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
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
      const lt = vi.fn(() => ({ limit }));
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
});
