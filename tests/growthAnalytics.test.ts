import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import {
  GROWTH_EVENT_NAMES,
  growthEventSchema,
  ingestGrowthEvents,
  parseGrowthEventRequest,
} from '@/lib/growthAnalytics';
import { POST } from '@/app/api/v1/analytics/events/route';

const INSTALL_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const RHYTHMS_EVENT_PROPERTIES = {
  rhythms_hub_viewed: { source_surface: 'rhythms_hub' },
  journey_catalog_viewed: { source_surface: 'rhythms_hub' },
  journey_detail_viewed: {
    catalog_code: 'hope-in-seven', source_surface: 'journey_catalog', journey_length_bucket: '2_7_days',
  },
  journey_started: {
    catalog_code: 'hope-in-seven', source_surface: 'journey_detail', journey_length_bucket: '2_7_days',
  },
  practice_catalog_viewed: { source_surface: 'rhythms_hub' },
  practice_selected: {
    catalog_code: 'guided_prayer', source_surface: 'practice_catalog', session_kind: 'guided_prayer',
  },
  weekly_rhythm_saved: { catalog_code: 'guided_prayer', session_kind: 'guided_prayer' },
  gathering_viewed: {
    catalog_code: 'weekly-rest', source_surface: 'rhythms_hub', session_length_bucket: '10_19m',
  },
  journey_session_started: {
    catalog_code: 'hope-in-seven', source_surface: 'home', session_kind: 'journey',
    journey_length_bucket: '2_7_days', cache_state: 'fresh',
  },
  journey_step_completed: {
    catalog_code: 'hope-in-seven', step_index: 1, step_type: 'verse', elapsed_bucket: 'under_30s',
  },
  journey_session_completed: {
    catalog_code: 'hope-in-seven', completion_reason: 'completed', elapsed_bucket: '2_4m',
  },
  journey_resumed: { catalog_code: 'hope-in-seven', source_surface: 'home', step_index: 1 },
  practice_session_started: {
    catalog_code: 'scripture', source_surface: 'weekly_rhythm', session_kind: 'scripture', network_state: 'online',
  },
  practice_session_completed: {
    catalog_code: 'scripture', session_kind: 'scripture', completion_reason: 'completed', elapsed_bucket: '5_14m',
  },
  practice_session_abandoned: {
    catalog_code: 'silence', session_kind: 'silence', abandonment_reason: 'user_exit', elapsed_bucket: '30_119s',
  },
  gathering_started: {
    catalog_code: 'weekly-rest', source_surface: 'gathering', session_kind: 'gathering',
    session_length_bucket: '10_19m',
  },
  gathering_step_completed: {
    catalog_code: 'weekly-rest', step_index: 1, step_type: 'arrival', elapsed_bucket: 'under_30s',
  },
  gathering_resumed: { catalog_code: 'weekly-rest', source_surface: 'gathering', step_index: 2 },
  gathering_completed: {
    catalog_code: 'weekly-rest', completion_reason: 'idempotent_replay', elapsed_bucket: '15m_plus',
  },
  journey_completed: {
    catalog_code: 'hope-in-seven', completion_reason: 'target_reached', journey_length_bucket: '2_7_days',
  },
  journey_completion_viewed: { catalog_code: 'hope-in-seven', source_surface: 'journey_completion' },
  journey_next_selected: { catalog_code: 'weekly-rest', source_surface: 'journey_completion' },
  weekly_rhythm_completed: {
    catalog_code: 'gratitude', session_kind: 'gratitude', completion_reason: 'target_reached',
  },
  weekly_rhythm_returned: {
    catalog_code: 'gratitude', source_surface: 'weekly_rhythm', session_kind: 'gratitude',
  },
  milestone_earned: { catalog_code: 'rhythm_first_week' },
  milestone_revealed: { catalog_code: 'streak_3', source_surface: 'milestones' },
  milestone_featured: { catalog_code: 'streak_7', source_surface: 'profile' },
  milestone_unfeatured: { catalog_code: 'streak_7', source_surface: 'profile' },
  milestone_shared: { catalog_code: 'journey_finisher', source_surface: 'milestones' },
  rhythms_load_failed: {
    source_surface: 'rhythms_hub', error_stage: 'summary_load', error_code: 'network_unavailable',
    network_state: 'offline', cache_state: 'miss', schema_version: 1, capability: 'journey_v2',
  },
  rhythms_mutation_failed: {
    source_surface: 'weekly_rhythm', error_stage: 'weekly_save', error_code: 'server_unavailable',
    network_state: 'degraded', cache_state: 'stale', schema_version: 1, capability: 'practices',
  },
  session_completion_conflict: {
    session_kind: 'gathering', error_stage: 'session_complete', error_code: 'conflict',
  },
  rhythms_asset_fallback_used: {
    catalog_code: 'flame.spark', source_surface: 'milestones', error_stage: 'asset_load',
    error_code: 'asset_unavailable', cache_state: 'fallback',
  },
} as const;

function event(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    install_id: INSTALL_ID,
    event_name: 'first_open',
    occurred_at: new Date().toISOString(),
    platform: 'ios',
    app_version: '1.0.0',
    locale: 'pt',
    properties: {},
    ...overrides,
  };
}

function request(events: unknown[], authorization?: string, headers?: Record<string, string>) {
  return new Request('https://vella.one/api/v1/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...headers,
    },
    body: JSON.stringify({ events }),
  });
}

function serviceClient(options?: {
  user?: { id: string } | null;
  authError?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options?.user ?? null },
        error: options?.authError ?? null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: options?.rpcData ?? {
        accepted: 1,
        inserted: 1,
        duplicates: 0,
        retention_policy: 'raw_90_days',
      },
      error: options?.rpcError ?? null,
    }),
  };
}

describe('growth analytics ingestion', () => {
  beforeEach(() => {
    mocks.createServiceClient.mockReset();
  });

  it('accepts the canonical mobile and website contracts', () => {
    expect(growthEventSchema.safeParse(event({
      funnel_variant: 'compact_v2',
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event()).success).toBe(true);
    for (const stepKey of ['language', 'goal', 'focus', 'minutes', 'rhythm', 'reminder_style', 'preview']) {
      expect(growthEventSchema.safeParse(event({
        event_name: 'onboarding_step',
        properties: { step_number: 1, total_steps: 7, step_key: stepKey },
      })).success).toBe(true);
    }
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_step',
      properties: { step_number: 3, total_steps: 5, step_key: 'focus' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_step_result',
      properties: {
        step_number: 2,
        total_steps: 2,
        step_key: 'focus',
        result: 'skipped',
        selection_count: 0,
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'route_resolved',
      session_id: '77777777-7777-4777-8777-777777777777',
      properties: {
        destination: 'onboarding',
        onboarding_state: 'incomplete',
        auth_state: 'anonymous',
        subscription_state: 'unknown',
        load_time_bucket: '500_1499ms',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'route_resolved',
      properties: {
        destination: 'first-experience',
        onboarding_state: 'incomplete',
        auth_state: 'anonymous',
        subscription_state: 'unknown',
        load_time_bucket: 'under_500ms',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'route_resolved',
      properties: {
        destination: 'offer',
        onboarding_state: 'complete',
        auth_state: 'anonymous',
        subscription_state: 'unknown',
        load_time_bucket: 'under_500ms',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_viewed',
      properties: { variant: 'v1', content_source: 'fallback' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      properties: { step_number: 4, total_steps: 4, step_key: 'completion', result: 'completed' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_viewed',
      funnel_variant: 'compact_v2',
      properties: { variant: 'compact_v2', content_source: 'remote' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      funnel_variant: 'compact_v2',
      properties: {
        variant: 'compact_v2',
        step_number: 1,
        total_steps: 2,
        step_key: 'moment',
        result: 'viewed',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      funnel_variant: 'compact_v2',
      properties: {
        variant: 'compact_v2',
        step_number: 2,
        total_steps: 2,
        step_key: 'completion',
        result: 'completed',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_completed',
      properties: { duration_bucket: '30_59s', content_source: 'remote' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_error',
      properties: { stage: 'navigation', error_code: 'navigation_failed' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_interaction',
      properties: { step_key: 'goal', action: 'selected', selection_count: 3 },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_interaction',
      properties: { step_key: 'goal', action: 'cta_visible', selection_count: 1 },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_interaction',
      properties: { step_key: 'focus', action: 'scroll_75', selection_count: 2 },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_interaction',
      properties: { step_key: 'focus', action: 'exit', selection_count: 0 },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_completed',
      properties: { duration_bucket: '30_59s', goal_count: 3, focus_count: 2 },
    })).success).toBe(true);
    // Older app builds use the original empty completion payload.
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_completed',
      properties: {},
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'auth_started',
      properties: { entry_point: 'post_onboarding' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'auth_started',
      properties: { entry_point: 'post_first_experience' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'auth_attempt',
      properties: {
        mode: 'sign_up',
        method: 'google',
        stage: 'provider',
        outcome: 'cancelled',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'account_created',
      properties: { method: 'apple' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'vella_profile_initialized',
      funnel_variant: 'compact_v2',
      properties: { provider_class: 'apple' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'purchase_validation_result',
      properties: { result: 'verified_active', plan: 'yearly' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'trial_terms_viewed',
      properties: { plan: 'yearly', trial_days_bucket: '14_days' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'subscription_management_opened',
      properties: { source: 'paywall', result: 'opened' },
    })).success).toBe(true);
    const diagnostics = [
      ['app_error', {
        surface: 'react_render', stage: 'render', error_code: 'unexpected_error',
        severity: 'recoverable', fingerprint: 'a'.repeat(64),
      }],
      ['startup_update_result', { outcome: 'current', duration_bucket: 'under_1s' }],
      ['data_operation_failed', { operation: 'query', domain: 'home', error_code: 'network_unavailable' }],
      ['paywall_catalog_result', { outcome: 'loaded', product_count: 2, duration_bucket: '1_4s' }],
      ['paywall_cta_tapped', { plan: 'yearly', auth_state: 'anonymous', offer_kind: 'annual_trial' }],
      ['pending_checkout_result', { stage: 'save', outcome: 'succeeded', plan: 'yearly' }],
      ['subscription_ownership_flow', { stage: 'conflict_presented', outcome: 'shown' }],
      ['profile_initialization_result', { outcome: 'existing', provider_class: 'google' }],
      ['attribution_install_result', { outcome: 'pending', reason: 'provider_not_ready' }],
    ] as const;
    for (const [eventName, properties] of diagnostics) {
      expect(growthEventSchema.safeParse(event({ event_name: eventName, properties })).success).toBe(true);
      for (const forbiddenKey of [
        'raw_error',
        'message',
        'stack',
        'url',
        'content',
        'user_id',
        'receipt',
        'purchase_token',
      ]) {
        expect(growthEventSchema.safeParse(event({
          event_name: eventName,
          properties: { ...properties, [forbiddenKey]: 'must-reject' },
        })).success).toBe(false);
      }
    }
    expect(growthEventSchema.safeParse(event({
      event_name: 'store_cta_clicked',
      platform: 'web',
      app_version: 'site',
      properties: {
        cta_id: 'hero_primary',
        store: 'android',
        source: 'Google',
        medium: 'CPC',
        campaign: 'Launch_BR',
      },
    })).success).toBe(true);
  });

  it('isolates a contract-invalid database event without blocking valid neighbors', async () => {
    const supabase = serviceClient();
    supabase.rpc.mockImplementation(async (_name: string, input: { p_events: Array<Record<string, unknown>> }) => {
      const containsRejected = input.p_events.some((candidate) => candidate.event_name === 'app_session_started');
      if (containsRejected) return { data: null, error: { code: '23514', message: 'check violation' } };
      return {
        data: {
          accepted: input.p_events.length,
          inserted: input.p_events.length,
          duplicates: 0,
          retention_policy: 'raw_90_days',
        },
        error: null,
      };
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
      event({
        event_id: '66666666-6666-4666-8666-666666666666',
        event_name: 'onboarding_started',
      }),
    ]));

    expect(result).toEqual({
      data: {
        accepted: 2,
        inserted: 2,
        duplicates: 0,
        rejected: 1,
        rejection_codes: { contract_mismatch: 1 },
        retention_policy: 'raw_90_days',
      },
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(5);
  });

  it('consumes every contract-invalid event when the whole batch is incompatible', async () => {
    const supabase = serviceClient();
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'check violation' },
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
      event({
        event_id: '66666666-6666-4666-8666-666666666666',
        event_name: 'onboarding_started',
      }),
    ]));

    expect(result).toEqual({
      data: {
        accepted: 0,
        inserted: 0,
        duplicates: 0,
        rejected: 3,
        rejection_codes: { contract_mismatch: 3 },
        retention_policy: 'raw_90_days',
      },
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(5);
  });

  it('aggregates inserted and duplicate counts across a split path', async () => {
    const supabase = serviceClient();
    supabase.rpc.mockImplementation(async (_name: string, input: { p_events: Array<Record<string, unknown>> }) => {
      if (input.p_events.some((candidate) => candidate.event_name === 'app_session_started')) {
        return { data: null, error: { code: '23514', message: 'check violation' } };
      }
      const duplicates = input.p_events.filter(
        (candidate) => candidate.event_name === 'onboarding_started',
      ).length;
      return {
        data: {
          accepted: input.p_events.length,
          inserted: input.p_events.length - duplicates,
          duplicates,
          retention_policy: 'raw_90_days',
        },
        error: null,
      };
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
      event({
        event_id: '66666666-6666-4666-8666-666666666666',
        event_name: 'onboarding_started',
      }),
    ]));

    expect(result).toEqual({
      data: {
        accepted: 2,
        inserted: 1,
        duplicates: 1,
        rejected: 1,
        rejection_codes: { contract_mismatch: 1 },
        retention_policy: 'raw_90_days',
      },
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(5);
  });

  it('does not split a batch for a non-contract database failure', async () => {
    const supabase = serviceClient({
      rpcError: { code: '08006', message: 'connection_failure_with_private_context' },
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
    ]));

    expect('response' in result && result.response.status).toBe(503);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('does not split rate-limited or capacity-limited batches', async () => {
    const events = [
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
    ];
    const rateLimited = serviceClient({
      rpcError: { code: 'P0001', message: 'growth_rate_limit_exceeded' },
    });
    mocks.createServiceClient.mockReturnValue(rateLimited);
    const rateResult = await ingestGrowthEvents(request(events));

    expect('response' in rateResult && rateResult.response.status).toBe(429);
    expect(rateLimited.rpc).toHaveBeenCalledTimes(1);

    const capacityLimited = serviceClient({
      rpcError: { code: 'P0001', message: 'growth_global_circuit_breaker_open' },
    });
    mocks.createServiceClient.mockReturnValue(capacityLimited);
    const capacityResult = await ingestGrowthEvents(request(events));

    expect('response' in capacityResult && capacityResult.response.status).toBe(503);
    if ('response' in capacityResult) {
      await expect(capacityResult.response.json()).resolves.toMatchObject({
        error: { details: { code: 'analytics_capacity_limited' } },
      });
    }
    expect(capacityLimited.rpc).toHaveBeenCalledTimes(1);
  });

  it('does not split a malformed successful RPC result', async () => {
    const supabase = serviceClient({
      rpcData: { accepted: 2, inserted: 2, retention_policy: 'raw_90_days' },
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_id: '44444444-4444-4444-8444-444444444444' }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'app_session_started',
      }),
    ]));

    expect('response' in result && result.response.status).toBe(503);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('logs only finite release dimensions and the safe contract code', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = serviceClient({
      rpcError: {
        code: '23514',
        message: `check failed for ${EVENT_ID} ${USER_ID} receipt-secret purchase-token-secret`,
      },
    });
    mocks.createServiceClient.mockReturnValue(supabase);
    const fingerprint = 'b'.repeat(64);

    try {
      const result = await ingestGrowthEvents(request([event({
        event_name: 'app_error',
        app_version: '1.3.0',
        build_number: '842',
        runtime_version: '1.3.0',
        funnel_variant: 'compact_v2',
        properties: {
          surface: 'react_render',
          stage: 'render',
          error_code: 'unexpected_error',
          severity: 'recoverable',
          fingerprint,
        },
      })]));

      expect(result).toEqual({
        data: {
          accepted: 0,
          inserted: 0,
          duplicates: 0,
          rejected: 1,
          rejection_codes: { contract_mismatch: 1 },
          retention_policy: 'raw_90_days',
        },
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('[growth-analytics] contract_event_rejected', {
        errorCode: '23514',
        eventName: 'app_error',
        platform: 'ios',
        appVersion: '1.3.0',
        buildNumber: '842',
        runtimeVersion: '1.3.0',
        funnelVariant: 'compact_v2',
      });
      const serializedLog = JSON.stringify(errorSpy.mock.calls);
      for (const forbiddenValue of [
        EVENT_ID,
        INSTALL_ID,
        USER_ID,
        fingerprint,
        'receipt-secret',
        'purchase-token-secret',
        'check failed',
      ]) {
        expect(serializedLog).not.toContain(forbiddenValue);
      }
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('rejects arbitrary, nested, content-bearing, and invalid canonical properties', () => {
    expect(growthEventSchema.safeParse(event({ funnel_variant: 'unknown_v3' })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'vella_profile_initialized',
      properties: { provider_class: 'google', user_id: USER_ID },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({ properties: { prayer_text: 'private' } })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({ properties: { content: { nested: true } } })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({ properties: { referrer: 'https://example.com/private' } })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_step',
      properties: { step_number: 8, total_steps: 7, step_key: 'focus' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_step',
      properties: { step_number: 3, total_steps: 5, step_key: 'email' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'onboarding_step_result',
      properties: {
        step_number: 1,
        total_steps: 2,
        step_key: 'language',
        result: 'continued',
        selection_count: 7,
      },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'auth_attempt',
      properties: {
        mode: 'sign_up',
        method: 'google',
        stage: 'provider',
        outcome: 'oauth_error_details',
      },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'purchase_validation_result',
      properties: { result: 'store_error_details', plan: 'yearly' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'trial_started',
      properties: {},
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_viewed',
      properties: { variant: 'v1', content_source: 'remote', verse: 'private content' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      properties: { step_number: 5, total_steps: 4, step_key: 'completion', result: 'completed' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      properties: { step_number: 2, total_steps: 4, step_key: 'scripture', result: 'skipped' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_completed',
      properties: { duration_bucket: '15_29s', content_source: 'remote', email: 'must-drop@example.com' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_error',
      properties: { stage: 'content_load', error_code: 'network_unavailable', raw_error: 'private' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'trial_terms_viewed',
      properties: { plan: 'yearly', trial_days_bucket: '14_days', receipt: 'private' },
    })).success).toBe(false);
    expect(growthEventSchema.safeParse(event({
      event_name: 'subscription_management_opened',
      properties: { source: 'settings', result: 'opened', purchase_token: 'private' },
    })).success).toBe(false);

    for (const properties of [
      { step_number: 1, total_steps: 2, step_key: 'moment', result: 'viewed' },
      { variant: 'compact_v2', step_number: 1, total_steps: 4, step_key: 'arrival', result: 'viewed' },
      { variant: 'compact_v2', step_number: 1, total_steps: 2, step_key: 'arrival', result: 'viewed' },
      { variant: 'compact_v2', step_number: 1, total_steps: 4, step_key: 'moment', result: 'viewed' },
      { step_number: 1, total_steps: 2, step_key: 'arrival', result: 'viewed' },
      { step_number: 1, total_steps: 4, step_key: 'moment', result: 'viewed' },
      { variant: 'v1', step_number: 1, total_steps: 4, step_key: 'arrival', result: 'viewed' },
      { variant: 'compact_v3', step_number: 1, total_steps: 2, step_key: 'moment', result: 'viewed' },
      { variant: 'compact_v2', step_number: 3, total_steps: 2, step_key: 'completion', result: 'completed' },
    ]) {
      expect(growthEventSchema.safeParse(event({
        event_name: 'first_experience_step',
        properties,
      })).success).toBe(false);
    }

    for (const mismatch of [
      event({
        event_name: 'first_experience_viewed',
        properties: { variant: 'compact_v2', content_source: 'remote' },
      }),
      event({
        event_name: 'first_experience_viewed',
        funnel_variant: 'legacy_v1',
        properties: { variant: 'compact_v2', content_source: 'remote' },
      }),
      event({
        event_name: 'first_experience_viewed',
        funnel_variant: 'compact_v2',
        properties: { variant: 'v1', content_source: 'remote' },
      }),
      event({
        event_name: 'first_experience_step',
        properties: {
          variant: 'compact_v2',
          step_number: 1,
          total_steps: 2,
          step_key: 'moment',
          result: 'viewed',
        },
      }),
      event({
        event_name: 'first_experience_step',
        funnel_variant: 'legacy_v1',
        properties: {
          variant: 'compact_v2',
          step_number: 1,
          total_steps: 2,
          step_key: 'moment',
          result: 'viewed',
        },
      }),
      event({
        event_name: 'first_experience_step',
        funnel_variant: 'compact_v2',
        properties: { step_number: 1, total_steps: 4, step_key: 'arrival', result: 'viewed' },
      }),
    ]) {
      expect(growthEventSchema.safeParse(mismatch).success).toBe(false);
    }

    for (const premiumIntent of [
      event({ event_name: 'paywall_viewed', properties: { source: 'google' } }),
      event({ event_name: 'plan_selected', properties: { plan: 'yearly', campaign: 'launch_br' } }),
      event({ event_name: 'checkout_started', properties: { plan: 'monthly', content: 'creative_1' } }),
      event({
        event_name: 'trial_terms_viewed',
        properties: { plan: 'yearly', trial_days_bucket: '14_days', source: 'google' },
      }),
    ]) {
      expect(growthEventSchema.safeParse(premiumIntent).success).toBe(false);
    }
  });

  it('ingests anonymous pre-auth events without inventing an identity', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const response = await POST(request([event()]));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      data: {
        accepted: 1,
        inserted: 1,
        duplicates: 0,
        rejected: 0,
        rejection_codes: { contract_mismatch: 0 },
        retention_policy: 'raw_90_days',
      },
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: [expect.objectContaining({ install_id: INSTALL_ID, event_name: 'first_open' })],
      p_authenticated: false,
    });
  });

  it('preserves the diagnostic anonymous and authenticated event boundaries', async () => {
    const anonymousEvents = [
      event({
        event_id: '00000000-0000-4000-8000-000000000001',
        event_name: 'app_error',
        properties: {
          surface: 'global_js',
          stage: 'bootstrap',
          error_code: 'unexpected_error',
          severity: 'fatal',
          fingerprint: 'a'.repeat(64),
        },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000002',
        event_name: 'startup_update_result',
        properties: { outcome: 'current', duration_bucket: 'under_1s' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000003',
        event_name: 'data_operation_failed',
        properties: { operation: 'query', domain: 'home', error_code: 'network_unavailable' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000004',
        event_name: 'paywall_catalog_result',
        properties: { outcome: 'loaded', product_count: 2, duration_bucket: '1_4s' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000005',
        event_name: 'paywall_cta_tapped',
        properties: { plan: 'yearly', auth_state: 'anonymous', offer_kind: 'annual_trial' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000006',
        event_name: 'pending_checkout_result',
        properties: { stage: 'save', outcome: 'succeeded', plan: 'yearly' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000007',
        event_name: 'attribution_install_result',
        properties: { outcome: 'pending', reason: 'provider_not_ready' },
      }),
    ];
    const anonymousClient = serviceClient({
      rpcData: { accepted: 7, inserted: 7, duplicates: 0, retention_policy: 'raw_90_days' },
    });
    mocks.createServiceClient.mockReturnValue(anonymousClient);

    const anonymousResult = await ingestGrowthEvents(request(anonymousEvents));

    expect('data' in anonymousResult).toBe(true);
    expect(anonymousClient.auth.getUser).not.toHaveBeenCalled();
    expect(anonymousClient.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: anonymousEvents,
      p_authenticated: false,
    });

    const authenticatedEvents = [
      event({
        event_id: '00000000-0000-4000-8000-000000000008',
        event_name: 'profile_initialization_result',
        properties: { outcome: 'existing', provider_class: 'google' },
      }),
      event({
        event_id: '00000000-0000-4000-8000-000000000009',
        event_name: 'subscription_ownership_flow',
        properties: { stage: 'conflict_presented', outcome: 'shown' },
      }),
    ];
    const unauthenticatedResult = await ingestGrowthEvents(request(authenticatedEvents));
    expect('response' in unauthenticatedResult && unauthenticatedResult.response.status).toBe(401);
    expect(anonymousClient.rpc).toHaveBeenCalledTimes(1);

    const authenticatedClient = serviceClient({
      user: { id: USER_ID },
      rpcData: { accepted: 2, inserted: 2, duplicates: 0, retention_policy: 'raw_90_days' },
    });
    mocks.createServiceClient.mockReturnValue(authenticatedClient);
    const authenticatedResult = await ingestGrowthEvents(request(authenticatedEvents, 'Bearer valid-token'));

    expect('data' in authenticatedResult).toBe(true);
    expect(authenticatedClient.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(authenticatedClient.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: authenticatedEvents,
      p_authenticated: true,
    });
  });

  it('ingests first-experience lifecycle events anonymously without an identity', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([event({
      event_name: 'first_experience_completed',
      properties: { duration_bucket: '15_29s', content_source: 'remote' },
    })]));

    expect('data' in result).toBe(true);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', expect.objectContaining({
      p_authenticated: false,
    }));
  });

  it('verifies bearer auth without passing or persisting the account identity', async () => {
    const supabase = serviceClient({ user: { id: USER_ID } });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([event({
      event_name: 'trial_started',
      properties: { plan: 'yearly' },
    })], 'Bearer valid-token'));

    expect('data' in result).toBe(true);
    expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', expect.objectContaining({
      p_authenticated: true,
    }));
    expect(JSON.stringify(supabase.rpc.mock.calls)).not.toContain(USER_ID);
  });

  it('never downgrades an invalid provided bearer token to anonymous', async () => {
    const supabase = serviceClient({ authError: { message: 'invalid token' } });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([event()], 'Bearer invalid-token'));

    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('accepts only the coarse Premium intent events before authentication', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const intentEvents = [
      event({ event_name: 'paywall_viewed', properties: {} }),
      event({
        event_id: '44444444-4444-4444-8444-444444444444',
        event_name: 'plan_selected',
        properties: { plan: 'monthly' },
      }),
      event({
        event_id: '55555555-5555-4555-8555-555555555555',
        event_name: 'trial_terms_viewed',
        properties: { plan: 'yearly', trial_days_bucket: '14_days' },
      }),
    ];
    const result = await ingestGrowthEvents(request(intentEvents));

    expect('data' in result).toBe(true);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: intentEvents,
      p_authenticated: false,
    });
  });

  it('retains the bearer boundary for checkout and post-purchase events', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    for (const analyticsEvent of [
      event({ event_name: 'checkout_started', properties: { plan: 'yearly' } }),
      event({ event_name: 'subscription_management_opened', properties: { source: 'settings', result: 'opened' } }),
      event({ event_name: 'purchase_validation_result', properties: { plan: 'yearly', result: 'verified_active' } }),
    ]) {
      const result = await ingestGrowthEvents(request([analyticsEvent]));
      expect('response' in result && result.response.status).toBe(401);
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('accepts checkout only after bearer authentication succeeds', async () => {
    const supabase = serviceClient({ user: { id: USER_ID } });
    mocks.createServiceClient.mockReturnValue(supabase);

    const checkout = event({
      event_name: 'checkout_started',
      properties: { plan: 'yearly' },
    });
    const result = await ingestGrowthEvents(request([checkout], 'Bearer valid-token'));

    expect('data' in result).toBe(true);
    expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: [checkout],
      p_authenticated: true,
    });
  });

  it('requires bearer authentication for a mixed batch containing checkout', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([
      event({ event_name: 'plan_selected', properties: { plan: 'yearly' } }),
      event({
        event_id: '44444444-4444-4444-8444-444444444444',
        event_name: 'checkout_started',
        properties: { plan: 'yearly' },
      }),
    ]));

    expect('response' in result && result.response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('never downgrades an invalid bearer on newly anonymous Premium intent', async () => {
    const supabase = serviceClient({ authError: { message: 'invalid token' } });
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([event({
      event_name: 'plan_selected',
      properties: { plan: 'yearly' },
    })], 'Bearer invalid-token'));

    expect('response' in result && result.response.status).toBe(401);
    expect(supabase.auth.getUser).toHaveBeenCalledWith('invalid-token');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects mixed installations, oversized requests, and web/mobile event mismatches', async () => {
    const mixed = await parseGrowthEventRequest(request([
      event(),
      event({
        event_id: '44444444-4444-4444-8444-444444444444',
        install_id: '55555555-5555-4555-8555-555555555555',
      }),
    ]));
    expect('response' in mixed && mixed.response.status).toBe(400);

    const oversized = await parseGrowthEventRequest(request(
      [event()],
      undefined,
      { 'Content-Length': String(33 * 1024) },
    ));
    expect('response' in oversized && oversized.response.status).toBe(413);

    const mismatch = await parseGrowthEventRequest(request([event({
      event_name: 'landing_viewed',
      platform: 'ios',
      app_version: '1.0.0',
    })]));
    expect('response' in mismatch && mismatch.response.status).toBe(400);
  });

  it('keeps the request batch bounded at twenty events', async () => {
    const events = Array.from({ length: 21 }, (_, index) => event({
      event_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }));

    const atLimit = await parseGrowthEventRequest(request(events.slice(0, 20)));
    expect('events' in atLimit && atLimit.events).toHaveLength(20);

    const overLimit = await parseGrowthEventRequest(request(events));
    expect('response' in overLimit && overLimit.response.status).toBe(400);
  });

  it('maps database rate limits and preserves idempotent duplicate counts', async () => {
    const rateLimited = serviceClient({
      rpcError: { code: 'P0001', message: 'growth_rate_limit_exceeded' },
    });
    mocks.createServiceClient.mockReturnValue(rateLimited);
    const limited = await ingestGrowthEvents(request([event()]));
    expect('response' in limited && limited.response.status).toBe(429);

    const capacityLimited = serviceClient({
      rpcError: { code: 'P0001', message: 'growth_global_circuit_breaker_open' },
    });
    mocks.createServiceClient.mockReturnValue(capacityLimited);
    const capacity = await ingestGrowthEvents(request([event()]));
    expect('response' in capacity && capacity.response.status).toBe(503);
    if ('response' in capacity) {
      await expect(capacity.response.json()).resolves.toMatchObject({
        error: { details: { code: 'analytics_capacity_limited' } },
      });
    }

    const duplicate = serviceClient({
      rpcData: { accepted: 1, inserted: 0, duplicates: 1, retention_policy: 'raw_90_days' },
    });
    mocks.createServiceClient.mockReturnValue(duplicate);
    const replay = await ingestGrowthEvents(request([event()]));
    expect(replay).toEqual({
      data: {
        accepted: 1,
        inserted: 0,
        duplicates: 1,
        rejected: 0,
        rejection_codes: { contract_mismatch: 0 },
        retention_policy: 'raw_90_days',
      },
    });
  });

  it('keeps database retention and privacy constraints in the migration', () => {
    const migration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations/20260806155202_growth_analytics.sql',
    ), 'utf8');
    const eventTable = migration.match(/create table if not exists faith_harbor\.growth_analytics_events \(([\s\S]*?)\n\);/)?.[1] ?? '';

    expect(eventTable).toContain("retention_policy text not null default 'raw_90_days'");
    expect(eventTable).toContain("delete_after timestamptz not null default (now() + interval '90 days')");
    expect(eventTable).not.toMatch(/\b(ip|ip_address|user_agent|raw_url|referrer|search_text|prayer_text)\b/i);
    expect(eventTable).not.toMatch(/\buser_id\b/);
    expect(migration).toContain('idx_growth_analytics_received_at');
    expect(migration).toContain("growth_global_circuit_breaker_open");
    expect(migration).toContain('where installs >= 20');
    expect(migration).toContain('having count(*) >= 20');
    expect(migration).toContain("'minimum_breakdown_installs', 20");

    const onboardingMigration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations/20260814151743_onboarding_route_interaction_telemetry.sql',
    ), 'utf8');
    expect(onboardingMigration).toContain("when 'route_resolved'");
    expect(onboardingMigration).toContain("when 'onboarding_interaction'");
    expect(onboardingMigration).toContain("when 'onboarding_error'");
    expect(onboardingMigration).not.toMatch(/prayer_text|email_address|user_id|receipt|purchase_token/i);

    const uiTelemetryMigration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations/20260816140743_onboarding_ui_visibility_telemetry.sql',
    ), 'utf8');
    expect(uiTelemetryMigration).toContain("'cta_visible'");
    expect(uiTelemetryMigration).toContain("'scroll_100'");
    expect(uiTelemetryMigration).toContain("'exit'");
    expect(uiTelemetryMigration).toContain('growth_event_properties_are_safe_v2');
    expect(uiTelemetryMigration).toContain(') not valid;');
    expect(uiTelemetryMigration).not.toContain('validate constraint growth_analytics_properties_check');
    expect(uiTelemetryMigration).not.toMatch(/prayer_text|email_address|user_id|receipt|purchase_token/i);

    const profileMigrationName = fs.readdirSync(path.resolve(process.cwd(), '../supabase/migrations'))
      .find((name) => name.endsWith('_vella_profile_initialization_v2.sql'));
    expect(profileMigrationName).toBeDefined();
    const profileMigration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations',
      profileMigrationName!,
    ), 'utf8');
    const observabilityMigrationName = fs.readdirSync(path.resolve(process.cwd(), '../supabase/migrations'))
      .find((name) => name.endsWith('_observability_diagnostic_contracts.sql'));
    expect(observabilityMigrationName).toBe('20260825222459_observability_diagnostic_contracts.sql');
    const observabilityMigration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations',
      observabilityMigrationName!,
    ), 'utf8');
    const telemetryMigrationName = fs.readdirSync(path.resolve(process.cwd(), '../supabase/migrations'))
      .find((name) => name.endsWith('_vella_rhythms_telemetry.sql'));
    expect(telemetryMigrationName).toBe('20260826042116_vella_rhythms_telemetry.sql');
    const telemetryMigration = fs.readFileSync(path.resolve(
      process.cwd(),
      '../supabase/migrations',
      telemetryMigrationName!,
    ), 'utf8');
    const eventConstraint = telemetryMigration.match(
      /growth_analytics_events_event_name_v8_check check \(event_name in \(([\s\S]*?)\n  \)\) not valid;/,
    )?.[1] ?? '';
    const databaseEventNames = [...eventConstraint.matchAll(/'([^']+)'/g)]
      .map((match) => match[1]);
    const rhythmsEventNames = new Set(Object.keys(RHYTHMS_EVENT_PROPERTIES));
    expect(GROWTH_EVENT_NAMES).toHaveLength(72);
    expect(rhythmsEventNames.size).toBe(33);
    expect(GROWTH_EVENT_NAMES.filter((eventName) => !rhythmsEventNames.has(eventName))).toHaveLength(39);
    expect([...databaseEventNames].sort()).toEqual([...GROWTH_EVENT_NAMES].sort());
    expect(new Set(databaseEventNames).size).toBe(databaseEventNames.length);
    expect(observabilityMigration).toContain('growth_event_properties_are_safe_v7');
    expect(observabilityMigration).toContain('select count(*) from jsonb_object_keys(p_properties)');
    expect(observabilityMigration).not.toContain('jsonb_object_length');
    expect(observabilityMigration).not.toMatch(/raw_error|stack_trace|email_address|user_id|receipt|purchase_token/i);
    expect(telemetryMigration).toContain('growth_event_properties_are_safe_v8');
    expect(telemetryMigration).toContain('growth_event_properties_are_safe_v7(p_event_name, p_properties)');
    expect(profileMigration).toContain('growth_event_properties_are_safe_v4');
    expect(profileMigration).toMatch(
      /growth_analytics_properties_check check \(\s*faith_harbor\.growth_event_properties_are_safe_v4\(event_name, properties\)\s*\) not valid;/,
    );
    expect(profileMigration).toContain('ensure_current_user_profile_v2()');
    expect(profileMigration).toContain('returning profile.id');
    expect(profileMigration).toContain('funnel_variant');
    expect(profileMigration).toContain("'vella_profile_initialized'");
    expect(profileMigration).toContain("'account_created'");
    expect(profileMigration).toContain("incoming ->> 'funnel_variant'");
    expect(profileMigration).toContain(') not valid;');
    expect(profileMigration).not.toMatch(/validate constraint growth_analytics_(?:properties|events_event_name)_check/);
  });

  it('keeps the shipped runtime-1.2 onboarding contract accepted by the database', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_restore_runtime_1_2_onboarding_analytics.sql'));
    expect(migrationName).toBeDefined();

    const migration = fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
    expect(migration).toContain('growth_event_properties_are_safe_v5');
    expect(migration).toContain('growth_event_properties_are_safe_v4');
    for (const stepKey of [
      'language',
      'goal',
      'focus',
      'minutes',
      'rhythm',
      'reminder_style',
      'preview',
      'reminders',
    ]) {
      expect(migration).toContain(`'${stepKey}'`);
    }
    for (const action of [
      'selected',
      'deselected',
      'continue_tapped',
      'skip_tapped',
      'retry_tapped',
      'cta_visible',
      'scroll_25',
      'scroll_50',
      'scroll_75',
      'scroll_100',
      'exit',
    ]) {
      expect(migration).toContain(`'${action}'`);
    }
    expect(migration).toMatch(
      /growth_analytics_properties_check check \(\s*faith_harbor\.growth_event_properties_are_safe_v5\(event_name, properties\)\s*\) not valid;/,
    );
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toMatch(/validate constraint growth_analytics_properties_check/);
    expect(migration).not.toMatch(/prayer_text|email_address|user_id|receipt|purchase_token/i);
  });

  it('adds the compact-v2 database contract without bypassing the live v5 validator', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_compact_v2_growth_contract.sql'));
    expect(migrationName).toBeDefined();

    const migration = fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
    expect(migration).toContain('growth_event_properties_are_safe_v6');
    expect(migration).toContain('growth_event_properties_are_safe_v5');
    expect(migration).toMatch(
      /growth_analytics_properties_check check \(\s*faith_harbor\.growth_event_properties_are_safe_v6\(event_name, properties\)\s*\) not valid;/,
    );
    expect(migration).toMatch(
      /growth_analytics_checkout_actor_check check \(\s*event_name <> 'checkout_started'\s+or actor_type = 'authenticated'\s*\) not valid;/,
    );
    expect(migration).toMatch(
      /growth_analytics_first_experience_variant_check check \(/,
    );
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toMatch(/validate constraint growth_analytics_(?:properties|checkout_actor)_check/);
    expect(migration).not.toMatch(/prayer_text|email_address|user_id|receipt|purchase_token/i);
  });

  it('keeps authoritative subscription transitions private, coarse, and atomically idempotent', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_subscription_marketing_transitions.sql'));
    expect(migrationName).toBeDefined();

    const migration = fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
    const transitionTable = migration.match(
      /create table faith_harbor\.subscription_marketing_transitions \(([\s\S]*?)\n\);/,
    )?.[1] ?? '';
    const syncFunction = migration.match(
      /create or replace function faith_harbor\.sync_iap_entitlement\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';

    expect(transitionTable).toContain('user_id uuid references auth.users(id) on delete set null');
    expect(transitionTable).toContain('subscription_id uuid not null');
    expect(transitionTable).not.toMatch(/subscription_id[^\n]*references/i);
    expect(transitionTable).toContain("provider text not null check (provider in ('apple', 'google'))");
    expect(transitionTable).toContain("plan text not null check (plan in ('monthly', 'yearly'))");
    expect(transitionTable).toContain("phase text not null check (phase in ('trial', 'paid'))");
    expect(transitionTable).toContain('claimed_at timestamptz');
    expect(transitionTable).toContain('delivered_at timestamptz');
    expect(transitionTable).toContain('unique (subscription_id, phase)');
    expect(transitionTable).not.toMatch(/receipt|purchase_token|transaction_id|content|email|name/i);

    expect(migration).toContain('enable row level security');
    expect(migration).toMatch(/revoke all on table faith_harbor\.subscription_marketing_transitions from public, anon, authenticated;/);
    expect(migration).toMatch(/grant select, insert, update, delete on table faith_harbor\.subscription_marketing_transitions to service_role;/);
    expect(migration).toContain('idx_subscription_marketing_transitions_oldest_undelivered');
    expect(migration).toContain('idx_subscription_marketing_transitions_occurred_phase');

    expect(migration).toMatch(
      /create or replace function faith_harbor\.sync_iap_entitlement\(\s*p_user_id uuid,\s*p_provider text,\s*p_store_product_id text,\s*p_store_transaction_id text,\s*p_active boolean,\s*p_entitlement_code text,\s*p_ends_at timestamptz,\s*p_auto_renew boolean,\s*p_platform text,\s*p_environment text,\s*p_billing_phase text\s*\)/,
    );
    expect(syncFunction).toMatch(
      /if p_billing_phase is not null and p_billing_phase not in \('trial', 'paid'\) then/,
    );
    expect(migration).toContain(
      'drop function if exists faith_harbor.apply_iap_subscription_state(text, text, boolean, timestamptz, timestamptz, boolean);',
    );
    expect(migration).toMatch(
      /create function faith_harbor\.apply_iap_subscription_state\(\s*p_provider text,\s*p_store_transaction_id text,\s*p_active boolean,\s*p_ends_at timestamptz,\s*p_event_at timestamptz,\s*p_auto_renew boolean,\s*p_billing_phase text\s*\)/,
    );
    expect(migration.match(/create function faith_harbor\.apply_iap_subscription_state\(/g)).toHaveLength(1);

    expect(migration.match(
      /on conflict on constraint subscription_marketing_transitions_subscription_id_phase_key do nothing/g,
    )).toHaveLength(2);
    expect(migration).toMatch(/lower\(btrim\(p_environment\)\) = 'production'/);
    expect(migration).toMatch(/p_active[\s\S]*p_billing_phase in \('trial', 'paid'\)/);
    expect(migration).toMatch(/p_billing_phase <> 'trial'[\s\S]*phase = 'paid'/);
    expect(migration).toMatch(/vella\.premium\.monthly[\s\S]*'monthly'/);
    expect(migration).toMatch(/vella\.premium\.yearly[\s\S]*'yearly'/);
  });

  it('leases the oldest transition until ACK without exposing identity or delivery state', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_subscription_marketing_transitions.sql'));
    const migration = fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
    const claimFunction = migration.match(
      /create function faith_harbor\.claim_subscription_marketing_transition\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';
    const claimProjection = claimFunction.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
    const ackFunction = migration.match(
      /create function faith_harbor\.ack_subscription_marketing_transition\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';

    expect(claimFunction).toContain('security invoker');
    expect(claimFunction).toMatch(/returns table \(\s*transition_id uuid,\s*plan text,\s*phase text,\s*occurred_at timestamptz\s*\)/);
    expect(claimFunction).toMatch(/delivered_at is null[\s\S]*order by[\s\S]*occurred_at[\s\S]*limit 1/);
    expect(claimFunction).toContain('for update skip locked');
    expect(claimFunction).toMatch(/claimed_at > [^;]*interval '5 minutes'[\s\S]*return;/);
    expect(claimFunction).toMatch(/set claimed_at = clock_timestamp\(\)/);
    expect(claimProjection).not.toMatch(/user_id|claimed_at|delivered_at/);

    expect(ackFunction).toContain('security invoker');
    expect(ackFunction).toMatch(/p_user_id uuid,\s*p_transition_id uuid/);
    expect(ackFunction).toContain('returns boolean');
    expect(ackFunction).toMatch(/user_id = p_user_id[\s\S]*transition_id = p_transition_id/);
    expect(ackFunction).toMatch(/delivered_at = coalesce\(delivered_at, clock_timestamp\(\)\)/);

    expect(migration).toMatch(/revoke all on function faith_harbor\.claim_subscription_marketing_transition\(uuid\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function faith_harbor\.claim_subscription_marketing_transition\(uuid\) to service_role;/);
    expect(migration).toMatch(/revoke all on function faith_harbor\.ack_subscription_marketing_transition\(uuid, uuid\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function faith_harbor\.ack_subscription_marketing_transition\(uuid, uuid\) to service_role;/);
  });

  it('bounds transition retention at 400 days using occurred_at', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_subscription_marketing_transitions.sql'));
    const migration = fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
    const purgeFunction = migration.match(
      /create function faith_harbor\.purge_expired_subscription_marketing_transitions\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';

    expect(purgeFunction).toContain('security invoker');
    expect(purgeFunction).toMatch(/occurred_at < date_trunc\('day', clock_timestamp\(\)\) - interval '400 days'/);
    expect(purgeFunction).toMatch(/limit greatest\(1, least\(coalesce\(p_limit, 50000\), 50000\)\)/);
    expect(migration).toMatch(/revoke all on function faith_harbor\.purge_expired_subscription_marketing_transitions\(integer\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function faith_harbor\.purge_expired_subscription_marketing_transitions\(integer\) to service_role;/);
  });

  it('accepts every exact Rhythms event contract without attribution inheritance', () => {
    for (const [eventName, properties] of Object.entries(RHYTHMS_EVENT_PROPERTIES)) {
      expect(GROWTH_EVENT_NAMES).toContain(eventName);
      expect(growthEventSchema.safeParse(event({ event_name: eventName, properties })).success).toBe(true);
      for (const [key, value] of [
        ['source', 'google'],
        ['campaign', 'launch'],
        ['user_id', USER_ID],
        ['reflection_text', 'private devotional content'],
        ['raw_error', `database row ${USER_ID} failed`],
      ]) {
        expect(growthEventSchema.safeParse(event({
          event_name: eventName,
          properties: { ...properties, [key]: value },
        })).success).toBe(false);
      }
    }
  });

  it('rejects arbitrary Rhythms catalogs, finite dimensions, indexes, buckets, and schema versions', () => {
    const invalidCases: Array<[keyof typeof RHYTHMS_EVENT_PROPERTIES, string, unknown]> = [
      ['journey_started', 'catalog_code', '11111111-1111-4111-8111-111111111111'],
      ['practice_selected', 'catalog_code', 'my-custom-practice'],
      ['milestone_featured', 'catalog_code', 'user_badge_slug'],
      ['journey_session_started', 'source_surface', 'custom_screen'],
      ['journey_session_started', 'session_kind', 'custom_session'],
      ['journey_session_started', 'journey_length_bucket', '7_exact_days'],
      ['journey_session_started', 'cache_state', 'disk_cache'],
      ['journey_step_completed', 'step_type', 'private_reflection'],
      ['journey_step_completed', 'elapsed_bucket', '37_seconds'],
      ['practice_session_completed', 'completion_reason', 'api_message'],
      ['practice_session_abandoned', 'abandonment_reason', 'free-form reason'],
      ['practice_session_started', 'network_state', '5g'],
      ['rhythms_load_failed', 'capability', 'experimental_capability'],
      ['rhythms_load_failed', 'error_stage', 'database_table_name'],
      ['rhythms_load_failed', 'error_code', 'PostgrestError: account 123'],
      ['rhythms_load_failed', 'schema_version', 2],
    ];
    for (const [eventName, field, value] of invalidCases) {
      expect(growthEventSchema.safeParse(event({
        event_name: eventName,
        properties: { ...RHYTHMS_EVENT_PROPERTIES[eventName], [field]: value },
      })).success).toBe(false);
    }
    for (const step_index of [0, 33, 1.5]) {
      expect(growthEventSchema.safeParse(event({
        event_name: 'gathering_step_completed',
        properties: { ...RHYTHMS_EVENT_PROPERTIES.gathering_step_completed, step_index },
      })).success).toBe(false);
    }
  });

  it('accepts Rhythms minimum and maximum indexes and bucket catalog values', () => {
    for (const properties of [
      RHYTHMS_EVENT_PROPERTIES.journey_step_completed,
      {
        ...RHYTHMS_EVENT_PROPERTIES.journey_step_completed,
        step_index: 32, step_type: 'gratitude', elapsed_bucket: '15m_plus',
      },
    ]) {
      expect(growthEventSchema.safeParse(event({
        event_name: 'journey_step_completed', properties,
      })).success).toBe(true);
    }
    expect(growthEventSchema.safeParse(event({
      event_name: 'journey_session_started',
      properties: {
        ...RHYTHMS_EVENT_PROPERTIES.journey_session_started,
        journey_length_bucket: '31_plus_days', cache_state: 'fallback',
      },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'gathering_started',
      properties: {
        ...RHYTHMS_EVENT_PROPERTIES.gathering_started,
        session_length_bucket: '20m_plus',
      },
    })).success).toBe(true);
  });

  it('keeps the existing API analytics catalog additive while Gathering v2 is database-scoped', () => {
    expect(GROWTH_EVENT_NAMES).toHaveLength(72);
    expect(new Set(GROWTH_EVENT_NAMES).size).toBe(72);
    expect(GROWTH_EVENT_NAMES).toEqual(expect.arrayContaining(Object.keys(RHYTHMS_EVENT_PROPERTIES)));
    expect(GROWTH_EVENT_NAMES).not.toContain('gathering_catalog_loaded');
    expect(GROWTH_EVENT_NAMES).not.toContain('gathering_card_selected');
    expect(GROWTH_EVENT_NAMES).not.toContain('gathering_session_abandoned');
  });

  it('requires authenticated ingestion for Rhythms completion telemetry and never forwards account identity', async () => {
    const unauthenticated = serviceClient();
    mocks.createServiceClient.mockReturnValueOnce(unauthenticated);
    const completion = event({
      event_name: 'practice_session_completed',
      properties: RHYTHMS_EVENT_PROPERTIES.practice_session_completed,
    });
    const rejected = await ingestGrowthEvents(request([completion]));
    expect('response' in rejected && rejected.response.status).toBe(401);

    const authenticated = serviceClient({ user: { id: USER_ID } });
    mocks.createServiceClient.mockReturnValueOnce(authenticated);
    const accepted = await ingestGrowthEvents(request([completion], 'Bearer valid-token'));
    expect('data' in accepted).toBe(true);
    expect(JSON.stringify(authenticated.rpc.mock.calls)).not.toContain(USER_ID);
  });
});
