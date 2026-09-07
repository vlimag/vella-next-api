import { describe, expect, it } from 'vitest';

import { checkoutLifecycleDiagnostics } from '@/lib/checkoutLifecycleDiagnostics';
import { growthEventSchema } from '@/lib/growthAnalytics';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('checkout lifecycle diagnostics', () => {
  it('accepts correlated start/result contracts and rejects unsafe lifecycle properties', () => {
    const envelope = {
      event_id: '44444444-4444-4444-8444-444444444444',
      install_id: '55555555-5555-4555-8555-555555555555',
      occurred_at: '2026-08-28T12:00:00.000Z',
      platform: 'android',
      app_version: '1.0.1',
      build_number: '26',
      runtime_version: '1.4',
      funnel_variant: 'compact_v2',
    };

    expect(growthEventSchema.safeParse({
      ...envelope,
      event_name: 'checkout_started',
      properties: { plan: 'yearly', attempt_id: A },
    }).success).toBe(true);
    expect(growthEventSchema.safeParse({
      ...envelope,
      event_id: '66666666-6666-4666-8666-666666666666',
      event_name: 'checkout_result',
      properties: {
        plan: 'yearly', attempt_id: A, outcome: 'timed_out', stage: 'store_callback',
      },
    }).success).toBe(true);
    expect(growthEventSchema.safeParse({
      ...envelope,
      event_name: 'checkout_result',
      properties: {
        plan: 'yearly', attempt_id: A, outcome: 'failed', stage: 'validation', receipt: 'forbidden',
      },
    }).success).toBe(false);
  });

  it('pairs attempts, reports terminal outcomes, and flags starts open beyond two minutes', () => {
    const diagnostics = checkoutLifecycleDiagnostics([
      {
        event_name: 'checkout_started',
        received_at: '2026-08-28T11:59:00.000Z',
        properties: { plan: 'yearly', attempt_id: A },
      },
      {
        event_name: 'checkout_result',
        received_at: '2026-08-28T11:59:30.000Z',
        properties: { plan: 'yearly', attempt_id: A, outcome: 'cancelled', stage: 'store_callback' },
      },
      {
        event_name: 'checkout_started',
        received_at: '2026-08-28T11:57:00.000Z',
        properties: { plan: 'monthly', attempt_id: B },
      },
      {
        event_name: 'checkout_started',
        received_at: '2026-08-28T11:59:30.000Z',
        properties: { plan: 'monthly', attempt_id: C },
      },
    ], Date.parse('2026-08-28T12:00:00.000Z'));

    expect(diagnostics).toEqual({
      audit_available: true,
      started_attempts: 3,
      terminal_attempts: 1,
      open_attempts: 2,
      open_over_2m: 1,
      legacy_uncorrelated_starts: 0,
      orphan_results: 0,
      duplicate_terminal_attempts: 0,
      by_outcome: [{ outcome: 'cancelled', count: 1 }],
      by_stage: [{ stage: 'store_callback', count: 1 }],
    });
  });

  it('fails closed for malformed rows and counts legacy starts separately', () => {
    expect(checkoutLifecycleDiagnostics([
      {
        event_name: 'checkout_started',
        received_at: '2026-08-28T11:59:00.000Z',
        properties: { plan: 'yearly' },
      },
      {
        event_name: 'checkout_result',
        received_at: '2026-08-28T11:59:30.000Z',
        properties: { plan: 'yearly', attempt_id: 'bad', outcome: 'failed', stage: 'unexpected' },
      },
    ], Date.parse('2026-08-28T12:00:00.000Z'))).toEqual({ audit_available: false });

    expect(checkoutLifecycleDiagnostics([
      {
        event_name: 'checkout_started',
        received_at: '2026-08-28T11:59:00.000Z',
        properties: { plan: 'yearly' },
      },
    ], Date.parse('2026-08-28T12:00:00.000Z'))).toMatchObject({
      audit_available: true,
      legacy_uncorrelated_starts: 1,
      started_attempts: 0,
    });
  });
});
