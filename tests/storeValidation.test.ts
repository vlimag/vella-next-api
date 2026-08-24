import { X509Certificate } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Status } from '@apple/app-store-server-library';
import { APPLE_ROOT_CERTIFICATES } from '../lib/appleRootCertificates';
import { deriveAppleSubscriptionUpdate } from '../lib/appleNotifications';
import { verifyAppleReceipt } from '../lib/appStore';
import {
  subscriptionStateFromPlaySubscription,
  verifiedPurchaseFromPlaySubscription,
} from '../lib/googlePlay';

type AppleInput = Parameters<typeof deriveAppleSubscriptionUpdate>[0];

function appleInput(overrides?: Partial<AppleInput>): AppleInput {
  return {
    notification: {
      notificationType: 'DID_RENEW',
      signedDate: 1_000,
      data: { status: Status.ACTIVE },
    },
    transaction: {
      originalTransactionId: 'apple-original-1',
      productId: 'vella.premium.yearly',
      expiresDate: 2_000,
    },
    renewal: null,
    ...overrides,
  };
}

describe('store validation normalization', () => {
  it('ships parseable Apple root trust anchors', () => {
    expect(APPLE_ROOT_CERTIFICATES).toHaveLength(3);
    for (const certificate of APPLE_ROOT_CERTIFICATES) {
      expect(() => new X509Certificate(certificate)).not.toThrow();
    }
  });

  it('preserves Apple’s verified app account token for the ownership check', async () => {
    const previousSecret = process.env.APPLE_SHARED_SECRET;
    const previousBundleId = process.env.APPLE_BUNDLE_ID;
    process.env.APPLE_SHARED_SECRET = 'test-secret';
    process.env.APPLE_BUNDLE_ID = 'io.vella.app';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 0,
      environment: 'Sandbox',
      receipt: { bundle_id: 'io.vella.app' },
      latest_receipt_info: [{
        product_id: 'vella.premium.monthly',
        original_transaction_id: 'apple-original-1',
        app_account_token: '11111111-1111-4111-8111-111111111111',
        expires_date_ms: String(Date.now() + 86_400_000),
        is_trial_period: 'false',
      }],
      pending_renewal_info: [{
        product_id: 'vella.premium.monthly',
        original_transaction_id: 'apple-original-1',
        auto_renew_status: '1',
      }],
    }))));

    try {
      const verified = await verifyAppleReceipt('base64-receipt', 'vella.premium.monthly');
      expect(verified?.appAccountToken).toBe('11111111-1111-4111-8111-111111111111');
    } finally {
      vi.unstubAllGlobals();
      if (previousSecret === undefined) delete process.env.APPLE_SHARED_SECRET;
      else process.env.APPLE_SHARED_SECRET = previousSecret;
      if (previousBundleId === undefined) delete process.env.APPLE_BUNDLE_ID;
      else process.env.APPLE_BUNDLE_ID = previousBundleId;
    }
  });

  it('grants an Apple renewal only through its verified expiry', () => {
    expect(deriveAppleSubscriptionUpdate(appleInput(), 1_000)).toEqual({
      originalTransactionId: 'apple-original-1',
      productId: 'vella.premium.yearly',
      active: true,
      endsAt: new Date(2_000).toISOString(),
      eventAt: new Date(1_000).toISOString(),
    });
  });

  it('uses the verified Apple grace-period expiry and rejects refunds', () => {
    const grace = deriveAppleSubscriptionUpdate(appleInput({
      notification: {
        notificationType: 'DID_FAIL_TO_RENEW',
        signedDate: 2_400,
        data: { status: Status.BILLING_GRACE_PERIOD },
      },
      renewal: { gracePeriodExpiresDate: 3_000 },
    }), 2_500);
    expect(grace?.active).toBe(true);
    expect(grace?.endsAt).toBe(new Date(3_000).toISOString());

    const refunded = deriveAppleSubscriptionUpdate(appleInput({
      notification: { notificationType: 'REFUND', signedDate: 1_000, data: { status: Status.ACTIVE } },
    }), 1_000);
    expect(refunded?.active).toBe(false);

    const refundReversed = deriveAppleSubscriptionUpdate(appleInput({
      notification: {
        notificationType: 'REFUND_REVERSED',
        signedDate: 1_500,
        data: { status: Status.ACTIVE },
      },
      transaction: {
        originalTransactionId: 'apple-original-1',
        productId: 'vella.premium.yearly',
        expiresDate: 3_000,
        revocationDate: 1_200,
      },
    }), 2_000);
    expect(refundReversed?.active).toBe(true);
  });

  it('normalizes active and canceled-but-unexpired Google v2 subscriptions', () => {
    const expiry = new Date(20_000).toISOString();
    const active = verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      testPurchase: {},
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: expiry,
        latestSuccessfulOrderId: 'GPA.1',
        autoRenewingPlan: { autoRenewEnabled: true },
      }],
    }, 'vella.premium.yearly', 'purchase-token', 10_000);
    expect(active).toMatchObject({
      productId: 'vella.premium.yearly',
      originalTransactionId: 'GPA.1',
      autoRenew: true,
      billingPhase: 'paid',
      environment: 'Test',
    });

    const canceled = verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
      lineItems: [{ productId: 'vella.premium.yearly', expiryTime: expiry }],
    }, 'vella.premium.yearly', 'purchase-token', 10_000);
    expect(canceled).not.toBeNull();
  });

  it('identifies the configured 14-day Google yearly trial from store dates', () => {
    const startMs = Date.parse('2026-08-10T12:00:00.000Z');
    const trial = verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      startTime: new Date(startMs).toISOString(),
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(startMs + 14 * 86_400_000).toISOString(),
        offerDetails: { offerId: 'trial-14-days' },
        autoRenewingPlan: { autoRenewEnabled: true },
      }],
    }, 'vella.premium.yearly', 'purchase-token', startMs + 1_000);

    expect(trial?.billingPhase).toBe('trial');
  });

  it('rejects pending, expired, and wrong-product Google purchases', () => {
    const future = new Date(20_000).toISOString();
    expect(verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_PENDING',
      lineItems: [{ productId: 'vella.premium.yearly', expiryTime: future }],
    }, 'vella.premium.yearly', 'token', 10_000)).toBeNull();

    expect(verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{ productId: 'vella.premium.yearly', expiryTime: new Date(5_000).toISOString() }],
    }, 'vella.premium.yearly', 'token', 10_000)).toBeNull();

    expect(verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{ productId: 'another.product', expiryTime: future }],
    }, 'vella.premium.yearly', 'token', 10_000)).toBeNull();
  });

  it('derives Google RTDN state without a non-existent subscriptionId field', () => {
    const state = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
      lineItems: [{
        productId: 'vella.premium.monthly',
        expiryTime: new Date(20_000).toISOString(),
      }],
    }, new Set(['vella.premium.monthly', 'vella.premium.yearly']), 10_000);

    expect(state).toMatchObject({
      active: false,
      productId: 'vella.premium.monthly',
      expiresAt: new Date(20_000),
    });
  });
});
