import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyGooglePubSubRequest: vi.fn(),
  getGooglePlaySubscription: vi.fn(),
  verifyAppleNotification: vi.fn(),
  deriveAppleSubscriptionUpdate: vi.fn(),
  updateIapSubscriptionState: vi.fn(),
  eventSingle: vi.fn(),
  eventUpsert: vi.fn(),
  processedFirstEq: vi.fn(),
  processedSecondEq: vi.fn(),
  billingUpdate: vi.fn(),
}));

vi.mock('../lib/googlePlay', async () => {
  const actual = await vi.importActual<typeof import('../lib/googlePlay')>('../lib/googlePlay');
  return {
    ...actual,
    verifyGooglePubSubRequest: mocks.verifyGooglePubSubRequest,
    getGooglePlaySubscription: mocks.getGooglePlaySubscription,
  };
});

vi.mock('../lib/appleNotifications', () => ({
  verifyAppleNotification: mocks.verifyAppleNotification,
  deriveAppleSubscriptionUpdate: mocks.deriveAppleSubscriptionUpdate,
}));

vi.mock('../lib/iap', () => ({
  updateIapSubscriptionState: mocks.updateIapSubscriptionState,
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table !== 'billing_events') throw new Error(`Unexpected table: ${table}`);
      return {
        upsert: mocks.eventUpsert,
        update: mocks.billingUpdate,
      };
    },
  }),
}));

import { POST as appleWebhook } from '../app/api/v1/webhooks/apple/route';
import { POST as googleWebhook } from '../app/api/v1/webhooks/google/route';

function googleRequest(payload: Record<string, unknown>, messageId = 'google-event-1') {
  return new Request('https://vella.one/api/v1/webhooks/google', {
    method: 'POST',
    headers: {
      authorization: 'Bearer signed-google-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        messageId,
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    }),
  });
}

describe('store webhook delivery', () => {
  const originalPackageName = process.env.ANDROID_PACKAGE_NAME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANDROID_PACKAGE_NAME = 'io.vella.app';
    mocks.verifyGooglePubSubRequest.mockResolvedValue({ ok: true });
    mocks.eventSingle.mockResolvedValue({ data: { processed_at: null }, error: null });
    mocks.eventUpsert.mockReturnValue({
      select: () => ({ single: mocks.eventSingle }),
    });
    mocks.processedSecondEq.mockResolvedValue({ error: null });
    mocks.processedFirstEq.mockReturnValue({ eq: mocks.processedSecondEq });
    mocks.billingUpdate.mockReturnValue({ eq: mocks.processedFirstEq });
    mocks.updateIapSubscriptionState.mockResolvedValue({ updated: true });
  });

  afterEach(() => {
    if (originalPackageName === undefined) delete process.env.ANDROID_PACKAGE_NAME;
    else process.env.ANDROID_PACKAGE_NAME = originalPackageName;
  });

  it('processes the official Google subscription RTDN shape without subscriptionId', async () => {
    mocks.getGooglePlaySubscription.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.yearly',
        expiryTime: new Date(Date.now() + 86_400_000).toISOString(),
        autoRenewingPlan: { autoRenewEnabled: true },
      }],
    });

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: { version: '1.0', notificationType: 2, purchaseToken: 'play-token' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.getGooglePlaySubscription).toHaveBeenCalledWith({
      packageName: 'io.vella.app',
      purchaseToken: 'play-token',
    });
    expect(mocks.updateIapSubscriptionState).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      storeTransactionId: 'play-token',
      active: true,
      autoRenew: true,
      eventAt: '2023-11-14T22:13:20.000Z',
      billingPhase: null,
    }));
  });

  it('revokes a voided Google subscription directly from its authenticated notification', async () => {
    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      eventTimeMillis: '1700000000000',
      voidedPurchaseNotification: {
        purchaseToken: 'voided-token',
        orderId: 'GPA.1',
        productType: 1,
        refundType: 1,
      },
    }));

    expect(response.status).toBe(200);
    expect(mocks.getGooglePlaySubscription).not.toHaveBeenCalled();
    expect(mocks.updateIapSubscriptionState).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      storeTransactionId: 'voided-token',
      active: false,
      autoRenew: false,
      billingPhase: null,
    }));
  });

  it('returns a retryable failure instead of revoking on a transient Google API error', async () => {
    mocks.getGooglePlaySubscription.mockRejectedValue(new Error('Google Play unavailable'));

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      subscriptionNotification: { notificationType: 2, purchaseToken: 'play-token' },
    }));

    expect(response.status).toBe(503);
    expect(mocks.updateIapSubscriptionState).not.toHaveBeenCalled();
    expect(mocks.billingUpdate).not.toHaveBeenCalled();
  });

  it('does not reprocess a store event already marked complete', async () => {
    mocks.eventSingle.mockResolvedValue({
      data: { processed_at: '2026-07-30T12:00:00.000Z' },
      error: null,
    });

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      subscriptionNotification: { notificationType: 2, purchaseToken: 'play-token' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(mocks.getGooglePlaySubscription).not.toHaveBeenCalled();
  });

  it('leaves an unlinked verified webhook unprocessed so the store retries it', async () => {
    mocks.getGooglePlaySubscription.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.monthly',
        expiryTime: new Date(Date.now() + 86_400_000).toISOString(),
      }],
    });
    mocks.updateIapSubscriptionState.mockResolvedValue({ updated: false, unlinked: true });

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: { notificationType: 2, purchaseToken: 'unlinked-token' },
    }));

    expect(response.status).toBe(503);
    expect(mocks.billingUpdate).not.toHaveBeenCalled();
  });

  it('leaves a malformed RPC result unprocessed so the store retries it', async () => {
    mocks.getGooglePlaySubscription.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.monthly',
        expiryTime: new Date(Date.now() + 86_400_000).toISOString(),
      }],
    });
    mocks.updateIapSubscriptionState.mockResolvedValue({
      updated: false,
      error: 'Invalid subscription state response',
    });

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: { notificationType: 2, purchaseToken: 'malformed-rpc-token' },
    }));

    expect(response.status).toBe(503);
    expect(mocks.billingUpdate).not.toHaveBeenCalled();
  });

  it('marks a stale verified webhook processed without changing entitlement state', async () => {
    mocks.getGooglePlaySubscription.mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{
        productId: 'vella.premium.monthly',
        expiryTime: new Date(Date.now() + 86_400_000).toISOString(),
      }],
    });
    mocks.updateIapSubscriptionState.mockResolvedValue({ updated: false, stale: true });

    const response = await googleWebhook(googleRequest({
      packageName: 'io.vella.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: { notificationType: 2, purchaseToken: 'stale-token' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.billingUpdate).toHaveBeenCalledTimes(1);
  });

  it('propagates Apple verified free-trial phase into the atomic state update', async () => {
    mocks.verifyAppleNotification.mockResolvedValue({
      notification: { notificationUUID: 'apple-trial-1', notificationType: 'DID_RENEW' },
      transaction: null,
      renewal: null,
    });
    mocks.deriveAppleSubscriptionUpdate.mockReturnValue({
      originalTransactionId: 'apple-original-1',
      productId: 'vella.premium.yearly',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      autoRenew: true,
      billingPhase: 'trial',
    });

    const response = await appleWebhook(new Request('https://vella.one/api/v1/webhooks/apple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signedPayload: 'signed-apple-payload' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateIapSubscriptionState).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'apple',
      billingPhase: 'trial',
    }));
  });

  it('asks Apple to retry when entitlement persistence fails', async () => {
    mocks.verifyAppleNotification.mockResolvedValue({
      notification: { notificationUUID: 'apple-event-1', notificationType: 'DID_RENEW' },
      transaction: null,
      renewal: null,
    });
    mocks.deriveAppleSubscriptionUpdate.mockReturnValue({
      originalTransactionId: 'apple-original-1',
      productId: 'vella.premium.yearly',
      active: true,
      endsAt: '2026-08-30T00:00:00.000Z',
      eventAt: '2026-07-30T00:00:00.000Z',
      autoRenew: true,
      billingPhase: 'paid',
    });
    mocks.updateIapSubscriptionState.mockResolvedValue({ updated: false, error: 'database unavailable' });

    const response = await appleWebhook(new Request('https://vella.one/api/v1/webhooks/apple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signedPayload: 'signed-apple-payload' }),
    }));

    expect(response.status).toBe(503);
    expect(mocks.billingUpdate).not.toHaveBeenCalled();
  });
});
