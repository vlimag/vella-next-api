import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

import { updateIapSubscriptionState } from '../lib/iap';

describe('webhook entitlement state updates', () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset().mockResolvedValue({
      data: { updated: true, stale: false, subscription_id: 'sub-1' },
      error: null,
    });
    mocks.rpc.mockReset().mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it('atomically applies a verified store event and entitlement state', async () => {
    const result = await updateIapSubscriptionState({
      provider: 'apple',
      storeTransactionId: 'apple-original-1',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      autoRenew: true,
      billingPhase: 'paid',
    });

    expect(result).toEqual({ updated: true });
    expect(mocks.rpc).toHaveBeenCalledWith('apply_iap_subscription_state', {
      p_provider: 'apple',
      p_store_transaction_id: 'apple-original-1',
      p_active: true,
      p_ends_at: '2026-08-30T00:00:00.000Z',
      p_event_at: '2026-07-30T00:00:00.000Z',
      p_auto_renew: true,
      p_billing_phase: 'paid',
    });
  });

  it('ignores a stale notification', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { updated: false, stale: true, subscription_id: 'sub-1' },
      error: null,
    });

    const result = await updateIapSubscriptionState({
      provider: 'apple',
      storeTransactionId: 'apple-original-1',
      active: false,
      endsAt: null,
      eventAt: '2026-07-29T00:00:00.000Z',
      billingPhase: 'trial',
    });

    expect(result).toEqual({ updated: false, stale: true });
  });

  it('keeps an event retryable when the atomic write fails', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const result = await updateIapSubscriptionState({
      provider: 'google',
      storeTransactionId: 'play-token',
      active: false,
      endsAt: null,
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: null,
    });

    expect(result).toEqual({ updated: false, error: 'database unavailable' });
  });

  it('identifies an event for an unlinked store transaction as retryable', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { updated: false, stale: false, subscription_id: null },
      error: null,
    });

    const result = await updateIapSubscriptionState({
      provider: 'google',
      storeTransactionId: 'not-linked-yet',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: 'paid',
    });

    expect(result).toEqual({ updated: false, unlinked: true });
  });

  it('falls back to the legacy six-argument RPC only when PostgREST cannot find the new signature', async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function faith_harbor.apply_iap_subscription_state(p_active, p_auto_renew, p_billing_phase, p_ends_at, p_event_at, p_provider, p_store_transaction_id) in the schema cache',
        },
      })
      .mockResolvedValueOnce({
        data: { updated: true, stale: false, subscription_id: 'sub-1' },
        error: null,
      });

    await expect(updateIapSubscriptionState({
      provider: 'google',
      storeTransactionId: 'play-token',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      autoRenew: true,
      billingPhase: 'paid',
    })).resolves.toEqual({ updated: true });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'apply_iap_subscription_state', {
      p_provider: 'google',
      p_store_transaction_id: 'play-token',
      p_active: true,
      p_ends_at: '2026-08-30T00:00:00.000Z',
      p_event_at: '2026-07-30T00:00:00.000Z',
      p_auto_renew: true,
      p_billing_phase: 'paid',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'apply_iap_subscription_state', {
      p_provider: 'google',
      p_store_transaction_id: 'play-token',
      p_active: true,
      p_ends_at: '2026-08-30T00:00:00.000Z',
      p_event_at: '2026-07-30T00:00:00.000Z',
      p_auto_renew: true,
    });
  });

  it('does not treat an unrelated PGRST202 as proof that the seven-argument RPC is absent', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function faith_harbor.another_function in the schema cache',
      },
    });

    await expect(updateIapSubscriptionState({
      provider: 'google',
      storeTransactionId: 'play-token',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: null,
    })).resolves.toEqual({
      updated: false,
      error: 'Could not find the function faith_harbor.another_function in the schema cache',
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('does not fall back for a missing signature other than the required seven arguments', async () => {
    const message = 'Could not find the function faith_harbor.apply_iap_subscription_state(p_provider) in the schema cache';
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message },
    });

    await expect(updateIapSubscriptionState({
      provider: 'google',
      storeTransactionId: 'play-token',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: null,
    })).resolves.toEqual({ updated: false, error: message });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    {},
    { updated: true, stale: true, subscription_id: 'sub-1' },
    { updated: true, stale: false, subscription_id: null },
    { updated: false, stale: false, subscription_id: 'sub-1' },
    { updated: false, stale: true, subscription_id: null },
  ])('rejects malformed or contradictory RPC state %#', async (data) => {
    mocks.maybeSingle.mockResolvedValue({ data, error: null });

    await expect(updateIapSubscriptionState({
      provider: 'apple',
      storeTransactionId: 'apple-original-1',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: 'paid',
    })).resolves.toEqual({
      updated: false,
      error: 'Invalid subscription state response',
    });
  });

  it('never falls back after a validation, permission, or database error', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(updateIapSubscriptionState({
      provider: 'apple',
      storeTransactionId: 'apple-original-1',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      billingPhase: 'paid',
    })).resolves.toEqual({ updated: false, error: 'permission denied' });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
