import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  atomicMaybeSingle: vi.fn(),
  receiptUpsert: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === 'in_app_purchase_receipts') {
        return { upsert: mocks.receiptUpsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import {
  purchaseAccountMatchesUser,
  syncIapEntitlement,
  toEntitlementCode,
} from '../lib/iap';

const verified = {
  productId: 'vella.premium.yearly',
  originalTransactionId: 'order-renewal-id',
  expiresAt: new Date(Date.now() + 86_400_000),
  autoRenew: true,
  billingPhase: 'trial' as const,
  environment: 'Sandbox',
  raw: {},
};

describe('IAP entitlement synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockReturnValue({ maybeSingle: mocks.atomicMaybeSingle });
    mocks.atomicMaybeSingle.mockResolvedValue({
      data: {
        active: true,
        entitlement_code: 'premium_individual',
        ends_at: verified.expiresAt.toISOString(),
        subscription_id: 'subscription-db-id',
        linked_to_other_account: false,
      },
      error: null,
    });
    mocks.receiptUpsert.mockResolvedValue({ error: null });
  });

  it('maps only explicitly family-named products to the family entitlement', () => {
    expect(toEntitlementCode('vella.premium.yearly')).toBe('premium_individual');
    expect(toEntitlementCode('vella.premium.family.yearly')).toBe('premium_family');
  });

  it('accepts legacy Apple purchases without an app account token and rejects a different bound account', () => {
    expect(purchaseAccountMatchesUser(verified, 'user-1')).toBe(true);
    expect(purchaseAccountMatchesUser({
      ...verified,
      appAccountToken: '11111111-1111-4111-8111-111111111111',
    }, '11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(purchaseAccountMatchesUser({
      ...verified,
      appAccountToken: '22222222-2222-4222-8222-222222222222',
    }, '11111111-1111-4111-8111-111111111111')).toBe(false);
  });

  it('uses the stable Google purchase token as the subscription identity', async () => {
    const result = await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000001',
      userId: 'user-1',
      platform: 'android',
      purchaseToken: 'stable-google-token',
      purchaseProof: 'stable-google-token',
      verified,
    });

    expect('error' in result).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith('sync_iap_entitlement', expect.objectContaining({
      p_store_transaction_id: 'stable-google-token',
      p_user_id: 'user-1',
    }));
  });

  it('does not reassign a store subscription linked to another Vella account', async () => {
    mocks.atomicMaybeSingle.mockResolvedValue({
      data: {
        active: true,
        entitlement_code: 'premium_individual',
        ends_at: verified.expiresAt.toISOString(),
        subscription_id: null,
        linked_to_other_account: true,
      },
      error: null,
    });

    const result = await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000002',
      userId: 'user-1',
      platform: 'ios',
      verified,
    });

    expect(result).toEqual({ error: 'This store subscription is already linked to another Vella account' });
    expect(mocks.receiptUpsert).not.toHaveBeenCalled();
  });

  it('keeps the whole state transition retryable when the atomic RPC fails', async () => {
    mocks.atomicMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const result = await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000003',
      userId: 'user-1',
      platform: 'ios',
      verified,
    });

    expect(result).toEqual({ error: 'database unavailable' });
    expect(mocks.receiptUpsert).not.toHaveBeenCalled();
  });
});
