import { beforeEach, describe, expect, it, vi } from 'vitest';

const CURRENT_USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const SIGNED_PROOF = 'header.payload.signature';

const mocks = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  purchaseAccountCanBeClaimedByUser: vi.fn(),
  verifyAppleReceipt: vi.fn(),
  verifyAppleSignedTransaction: vi.fn(),
  syncIapEntitlement: vi.fn(),
  recordFailedIapAttempt: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserIdFromAuthHeader,
}));

vi.mock('@/lib/appStore', () => ({
  verifyAppleReceipt: mocks.verifyAppleReceipt,
  verifyAppleSignedTransaction: mocks.verifyAppleSignedTransaction,
}));

vi.mock('@/lib/googlePlay', () => ({
  verifyGooglePlaySubscription: vi.fn(),
}));

vi.mock('@/lib/iap', () => ({
  purchaseAccountCanBeClaimedByUser: mocks.purchaseAccountCanBeClaimedByUser,
  syncIapEntitlement: mocks.syncIapEntitlement,
}));

vi.mock('@/lib/iapAudit', () => ({
  recordFailedIapAttempt: mocks.recordFailedIapAttempt,
}));

vi.mock('@/lib/iapProducts', () => ({
  isVellaSubscriptionProduct: () => true,
}));

import { POST } from '@/app/api/v1/iap/validate-receipt/route';

function request() {
  return new Request('https://vella.one/api/v1/iap/validate-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'ios',
      productId: 'vella.premium.monthly',
      signedTransaction: SIGNED_PROOF,
    }),
  });
}

function verifiedPurchase(appAccountToken: string | null) {
  return {
    productId: 'vella.premium.monthly',
    originalTransactionId: 'apple-original-1',
    appAccountToken,
    expiresAt: new Date(Date.now() + 86_400_000),
    autoRenew: true,
    billingPhase: 'paid' as const,
    environment: 'Sandbox',
    raw: {},
  };
}

describe('IAP validation account binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserIdFromAuthHeader.mockResolvedValue({
      userId: CURRENT_USER_ID,
      isAnonymous: false,
    });
    mocks.recordFailedIapAttempt.mockResolvedValue(undefined);
    mocks.purchaseAccountCanBeClaimedByUser.mockResolvedValue(true);
    mocks.syncIapEntitlement.mockResolvedValue({
      active: true,
      entitlementCode: 'premium_individual',
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      subscriptionId: 'subscription-1',
    });
  });

  it('rejects a signed Apple transaction bound to a permanent different Vella account', async () => {
    mocks.verifyAppleSignedTransaction.mockResolvedValue(verifiedPurchase(OTHER_USER_ID));
    mocks.purchaseAccountCanBeClaimedByUser.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { details: { code: 'subscription_account_mismatch' } },
    });
    expect(mocks.syncIapEntitlement).not.toHaveBeenCalled();
  });

  it('accepts a signed Apple transaction bound to the authenticated account', async () => {
    mocks.verifyAppleSignedTransaction.mockResolvedValue(verifiedPurchase(CURRENT_USER_ID));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.syncIapEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      userId: CURRENT_USER_ID,
      platform: 'ios',
    }));
    expect(mocks.getUserIdFromAuthHeader).toHaveBeenCalledWith({ allowAnonymous: true });
  });

  it('accepts a mismatched token only after the server confirms its owner is anonymous', async () => {
    mocks.verifyAppleSignedTransaction.mockResolvedValue(verifiedPurchase(OTHER_USER_ID));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.purchaseAccountCanBeClaimedByUser).toHaveBeenCalledWith(
      expect.objectContaining({ appAccountToken: OTHER_USER_ID }),
      CURRENT_USER_ID,
      { currentUserIsAnonymous: false },
    );
    expect(mocks.syncIapEntitlement).toHaveBeenCalledTimes(1);
  });

  it('marks a signed-out installation as anonymous during store reconciliation', async () => {
    mocks.getUserIdFromAuthHeader.mockResolvedValue({
      userId: CURRENT_USER_ID,
      isAnonymous: true,
    });
    mocks.verifyAppleSignedTransaction.mockResolvedValue(verifiedPurchase(OTHER_USER_ID));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.purchaseAccountCanBeClaimedByUser).toHaveBeenCalledWith(
      expect.objectContaining({ appAccountToken: OTHER_USER_ID }),
      CURRENT_USER_ID,
      { currentUserIsAnonymous: true },
    );
  });

  it('does not expose account identifiers or signed proof when verification fails', async () => {
    mocks.verifyAppleSignedTransaction.mockRejectedValue(
      new Error(`invalid ${SIGNED_PROOF} for ${CURRENT_USER_ID}`),
    );
    mocks.verifyAppleReceipt.mockResolvedValue(null);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await POST(request());
    const responseJson = await response.json();
    const visible = JSON.stringify({ responseJson, logs: warning.mock.calls });

    expect(response.status).toBe(402);
    expect(visible).not.toContain(SIGNED_PROOF);
    expect(visible).not.toContain(CURRENT_USER_ID);
    expect(visible).not.toContain(OTHER_USER_ID);
  });
});
