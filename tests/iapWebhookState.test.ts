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
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: { updated: true, stale: false, subscription_id: 'sub-1' },
      error: null,
    });
    mocks.rpc.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it('atomically applies a verified store event and entitlement state', async () => {
    const result = await updateIapSubscriptionState({
      provider: 'apple',
      storeTransactionId: 'apple-original-1',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      autoRenew: true,
    });

    expect(result).toEqual({ updated: true });
    expect(mocks.rpc).toHaveBeenCalledWith('apply_iap_subscription_state', {
      p_provider: 'apple',
      p_store_transaction_id: 'apple-original-1',
      p_active: true,
      p_ends_at: '2026-08-30T00:00:00.000Z',
      p_event_at: '2026-07-30T00:00:00.000Z',
      p_auto_renew: true,
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
    });

    expect(result).toEqual({ updated: false, error: 'database unavailable' });
  });

  it('treats an event for an unlinked store transaction as a no-op', async () => {
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
    });

    expect(result).toEqual({ updated: false });
  });
});
