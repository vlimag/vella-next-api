import { X509Certificate } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { OfferDiscountType, OfferType, Status } from '@apple/app-store-server-library';

const appleVerificationMocks = vi.hoisted(() => ({
  verifyAppleTransactionJws: vi.fn(),
}));

vi.mock('@/lib/appleNotifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/appleNotifications')>()),
  verifyAppleTransactionJws: appleVerificationMocks.verifyAppleTransactionJws,
}));

import { APPLE_ROOT_CERTIFICATES } from '../lib/appleRootCertificates';
import { deriveAppleSubscriptionUpdate } from '../lib/appleNotifications';
import { verifyAppleReceipt, verifyAppleSignedTransaction } from '../lib/appStore';
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
      billingPhase: 'paid',
    });
  });

  it('derives an Apple trial only from verified introductory free-trial evidence', () => {
    const trial = deriveAppleSubscriptionUpdate(appleInput({
      transaction: {
        originalTransactionId: 'apple-original-1',
        productId: 'vella.premium.yearly',
        expiresDate: 2_000,
        offerType: OfferType.INTRODUCTORY_OFFER,
        offerDiscountType: OfferDiscountType.FREE_TRIAL,
      },
    }), 1_000);
    const paidIntroductoryOffer = deriveAppleSubscriptionUpdate(appleInput({
      transaction: {
        originalTransactionId: 'apple-original-1',
        productId: 'vella.premium.yearly',
        expiresDate: 2_000,
        offerType: OfferType.INTRODUCTORY_OFFER,
        offerDiscountType: OfferDiscountType.PAY_UP_FRONT,
      },
    }), 1_000);

    expect(trial?.billingPhase).toBe('trial');
    expect(paidIntroductoryOffer?.billingPhase).toBe('paid');
  });

  it('derives a direct signed Apple trial only from an introductory free-trial discount', async () => {
    appleVerificationMocks.verifyAppleTransactionJws
      .mockResolvedValueOnce({
        transaction: {
          originalTransactionId: 'apple-direct-free-trial',
          productId: 'vella.premium.yearly',
          expiresDate: 2_000,
          offerType: OfferType.INTRODUCTORY_OFFER,
          offerDiscountType: OfferDiscountType.FREE_TRIAL,
        },
        environment: 'Sandbox',
      })
      .mockResolvedValueOnce({
        transaction: {
          originalTransactionId: 'apple-direct-paid-intro',
          productId: 'vella.premium.yearly',
          expiresDate: 2_000,
          offerType: OfferType.INTRODUCTORY_OFFER,
          offerDiscountType: OfferDiscountType.PAY_UP_FRONT,
        },
        environment: 'Sandbox',
      });

    const freeTrial = await verifyAppleSignedTransaction(
      'signed-free-trial',
      'vella.premium.yearly',
    );
    const paidIntro = await verifyAppleSignedTransaction(
      'signed-paid-intro',
      'vella.premium.yearly',
    );

    expect(freeTrial?.billingPhase).toBe('trial');
    expect(paidIntro?.billingPhase).toBe('paid');
  });

  it('keeps Apple access updates phase-unknown when no verified transaction is present', () => {
    const update = deriveAppleSubscriptionUpdate(appleInput({
      transaction: null,
      renewal: {
        originalTransactionId: 'apple-original-1',
        productId: 'vella.premium.yearly',
        renewalDate: 2_000,
      },
    }), 1_000);

    expect(update).toMatchObject({ active: true, billingPhase: null });
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
        offerPhase: { basePrice: {} },
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

  it('derives Google trial only from the authoritative current free-trial phase', () => {
    const nowMs = Date.parse('2026-08-10T12:00:00.000Z');
    const trial = verifiedPurchaseFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(nowMs + 14 * 86_400_000).toISOString(),
        offerPhase: { freeTrial: {} },
        autoRenewingPlan: { autoRenewEnabled: true },
      }],
    }, 'vella.premium.yearly', 'purchase-token', nowMs);

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
      billingPhase: null,
    });
  });

  it('derives Google webhook trial then paid from the authoritative offer phase', () => {
    const startMs = Date.parse('2026-08-10T12:00:00.000Z');
    const trial = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(startMs + 14 * 86_400_000).toISOString(),
        offerPhase: { freeTrial: {} },
      }],
    }, new Set(['vella.premium.yearly']), startMs + 1_000);
    const paidRenewal = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(startMs + 379 * 86_400_000).toISOString(),
        latestSuccessfulOrderId: 'GPA.paid-renewal',
        offerPhase: { basePrice: {} },
      }],
    }, new Set(['vella.premium.yearly']), startMs + 20 * 86_400_000);

    expect(trial?.billingPhase).toBe('trial');
    expect(paidRenewal?.billingPhase).toBe('paid');
  });

  it.each([
    ['absent', undefined],
    ['introductory price', { introductoryPrice: {} }],
    ['proration', { prorationPeriod: {} }],
    ['base price without a successful order', { basePrice: {} }],
  ])('keeps Google %s phase out of marketing truth', (_label, offerPhase) => {
    const state = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(20_000).toISOString(),
        offerPhase,
      }],
    }, new Set(['vella.premium.yearly']), 10_000);

    expect(state?.billingPhase).toBeNull();
  });

  it('does not turn a trial into paid when its first renewal enters grace', () => {
    const expiryTime = new Date(20_000).toISOString();
    const trial = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime,
        offerPhase: { freeTrial: {} },
      }],
    }, new Set(['vella.premium.yearly']), 10_000);
    const declinedRenewal = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime,
        latestSuccessfulOrderId: 'GPA.trial-start',
        offerPhase: { basePrice: {} },
      }],
    }, new Set(['vella.premium.yearly']), 10_000);
    const staleTrialPhaseInGrace = subscriptionStateFromPlaySubscription({
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime,
        offerPhase: { freeTrial: {} },
      }],
    }, new Set(['vella.premium.yearly']), 10_000);

    expect(trial?.billingPhase).toBe('trial');
    expect(declinedRenewal?.billingPhase).toBeNull();
    expect(staleTrialPhaseInGrace?.billingPhase).toBeNull();
  });
});
