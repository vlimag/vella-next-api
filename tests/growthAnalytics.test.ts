import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { growthEventSchema, ingestGrowthEvents, parseGrowthEventRequest } from '@/lib/growthAnalytics';
import { POST } from '@/app/api/v1/analytics/events/route';

const INSTALL_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

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
      event_name: 'first_experience_viewed',
      properties: { variant: 'v1', content_source: 'fallback' },
    })).success).toBe(true);
    expect(growthEventSchema.safeParse(event({
      event_name: 'first_experience_step',
      properties: { step_number: 4, total_steps: 4, step_key: 'completion', result: 'completed' },
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
  });

  it('ingests anonymous pre-auth events without inventing an identity', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const response = await POST(request([event()]));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      data: { accepted: 1, inserted: 1, duplicates: 0, retention_policy: 'raw_90_days' },
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_growth_analytics_events', {
      p_events: [expect.objectContaining({ install_id: INSTALL_ID, event_name: 'first_open' })],
      p_authenticated: false,
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

  it('requires authentication for post-auth lifecycle events', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    const result = await ingestGrowthEvents(request([event({
      event_name: 'paywall_viewed',
      properties: {},
    })]));

    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('retains the bearer boundary for trial and paywall management events', async () => {
    const supabase = serviceClient();
    mocks.createServiceClient.mockReturnValue(supabase);

    for (const analyticsEvent of [
      event({ event_name: 'trial_terms_viewed', properties: { plan: 'yearly', trial_days_bucket: 'other' } }),
      event({ event_name: 'subscription_management_opened', properties: { source: 'settings', result: 'opened' } }),
    ]) {
      const result = await ingestGrowthEvents(request([analyticsEvent]));
      expect('response' in result && result.response.status).toBe(401);
    }
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
      data: { accepted: 1, inserted: 0, duplicates: 1, retention_policy: 'raw_90_days' },
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
    const eventConstraint = profileMigration.match(
      /growth_analytics_events_event_name_check check \(event_name in \(([\s\S]*?)\n  \)\) not valid;/,
    )?.[1] ?? '';
    const databaseEventNames = [...eventConstraint.matchAll(/'([^']+)'/g)]
      .map((match) => match[1]);
    const apiEventNames = growthEventSchema.options.map((option) => (
      option.shape.event_name.value
    ));

    expect([...databaseEventNames].sort()).toEqual([...apiEventNames].sort());
    expect(new Set(databaseEventNames).size).toBe(databaseEventNames.length);
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
});
