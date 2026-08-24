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
    mocks.rpc.mockReset().mockReturnValue({ maybeSingle: mocks.atomicMaybeSingle });
    mocks.atomicMaybeSingle.mockReset().mockResolvedValue({
      data: {
        active: true,
        entitlement_code: 'premium_individual',
        ends_at: verified.expiresAt.toISOString(),
        subscription_id: 'subscription-db-id',
        linked_to_other_account: false,
      },
      error: null,
    });
    mocks.receiptUpsert.mockReset().mockResolvedValue({ error: null });
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
      p_billing_phase: 'trial',
    }));
  });

  it('sends a production annual trial through the existing eleven-argument RPC contract', async () => {
    await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000004',
      userId: 'user-1',
      platform: 'ios',
      verified: { ...verified, environment: 'Production' },
    });

    expect(mocks.rpc).toHaveBeenCalledWith('sync_iap_entitlement', {
      p_user_id: 'user-1',
      p_provider: 'apple',
      p_store_product_id: 'vella.premium.yearly',
      p_store_transaction_id: 'order-renewal-id',
      p_active: true,
      p_entitlement_code: 'premium_individual',
      p_ends_at: verified.expiresAt.toISOString(),
      p_auto_renew: true,
      p_platform: 'ios',
      p_environment: 'Production',
      p_billing_phase: 'trial',
    });
  });

  it('sends a production monthly paid purchase through the same RPC contract', async () => {
    await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000005',
      userId: 'user-1',
      platform: 'android',
      purchaseToken: 'monthly-token',
      verified: {
        ...verified,
        productId: 'vella.premium.monthly',
        originalTransactionId: 'GPA.monthly',
        billingPhase: 'paid',
        environment: 'Production',
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith('sync_iap_entitlement', expect.objectContaining({
      p_store_product_id: 'vella.premium.monthly',
      p_store_transaction_id: 'monthly-token',
      p_environment: 'Production',
      p_billing_phase: 'paid',
    }));
  });

  it('keeps unknown direct phase out of marketing without blocking access during the staged rollout', async () => {
    mocks.atomicMaybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: '22023', message: 'billing_phase must be trial or paid' },
      })
      .mockResolvedValueOnce({
        data: {
          active: true,
          entitlement_code: 'premium_individual',
          ends_at: verified.expiresAt.toISOString(),
          subscription_id: 'subscription-db-id',
          linked_to_other_account: false,
        },
        error: null,
      });

    const result = await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000006',
      userId: 'user-1',
      platform: 'android',
      purchaseToken: 'unknown-phase-token',
      verified: { ...verified, billingPhase: null, environment: 'Production' },
    });

    expect(result).toMatchObject({ active: true, subscriptionId: 'subscription-db-id' });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'sync_iap_entitlement', expect.objectContaining({
      p_billing_phase: null,
    }));
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'sync_iap_entitlement', expect.objectContaining({
      p_billing_phase: 'paid',
    }));
  });

  it('does not retry an unknown phase after any unrelated database error', async () => {
    mocks.atomicMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const result = await syncIapEntitlement({
      requestId: '00000000-0000-4000-8000-000000000007',
      userId: 'user-1',
      platform: 'android',
      purchaseToken: 'unknown-phase-token',
      verified: { ...verified, billingPhase: null, environment: 'Production' },
    });

    expect(result).toEqual({ error: 'permission denied' });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
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
