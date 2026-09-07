import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { ok, fail } from '@/lib/http';
import { verifyAppleReceipt, verifyAppleSignedTransaction } from '@/lib/appStore';
import { verifyGooglePlaySubscription } from '@/lib/googlePlay';
import {
  purchaseAccountCanBeClaimedByUser,
  syncIapEntitlement,
  type VerifiedPurchase,
} from '@/lib/iap';
import { recordFailedIapAttempt, type IapPlatform } from '@/lib/iapAudit';
import { isVellaSubscriptionProduct } from '@/lib/iapProducts';

const bodySchema = z.object({
  platform: z.enum(['ios', 'android']),
  productId: z.string().trim().min(1),
  // iOS: base64 app receipt. Android: the purchase token.
  receiptData: z.string().trim().optional().default(''),
  signedTransaction: z.string().trim().min(1).optional(),
  packageName: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const requestId = randomUUID();
  const auth = await getUserIdFromAuthHeader({ allowAnonymous: true });
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    await recordFailedIapAttempt({
      requestId,
      userId: auth.userId,
      errorCode: 'invalid_request',
    });
    return fail('Invalid request input', 400, { code: 'invalid_request', requestId });
  }

  const { platform, productId, receiptData, signedTransaction, packageName } = parsed.data;
  const proof = signedTransaction || receiptData;
  const reject = async (params: {
    message: string;
    status: number;
    code: string;
    source?: 'server_validation' | 'entitlement_sync';
    retryable?: boolean;
    metadata?: Record<string, boolean | number | string | null>;
    details?: Record<string, unknown>;
  }) => {
    await recordFailedIapAttempt({
      requestId,
      userId: auth.userId,
      platform: platform as IapPlatform,
      productId,
      source: params.source,
      errorCode: params.code,
      proof,
      retryable: params.retryable,
      metadata: params.metadata,
    });
    return fail(params.message, params.status, {
      code: params.code,
      requestId,
      ...params.details,
    });
  };

  if (platform === 'ios' && !receiptData && !signedTransaction) {
    return reject({ message: 'Missing Apple purchase proof', status: 400, code: 'receipt_missing' });
  }
  if (platform === 'android' && !receiptData) {
    return reject({ message: 'Missing Google purchase token', status: 400, code: 'receipt_missing' });
  }
  if (!isVellaSubscriptionProduct(productId)) {
    return reject({ message: 'Unknown subscription product', status: 400, code: 'product_not_allowed' });
  }

  try {
    let verified: VerifiedPurchase | null = null;
    if (platform === 'ios') {
      if (signedTransaction) {
        try {
          verified = await verifyAppleSignedTransaction(signedTransaction, productId);
        } catch (error) {
          console.warn('[iap.apple] signed_transaction_rejected', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      }
      if (!verified && receiptData) verified = await verifyAppleReceipt(receiptData, productId);
    } else {
      const configuredPackageName = process.env.ANDROID_PACKAGE_NAME?.trim();
      if (!configuredPackageName) {
        return reject({
          message: 'Google Play validation is not configured',
          status: 503,
          code: 'iap_configuration_missing',
          retryable: true,
        });
      }
      if (packageName && packageName !== configuredPackageName) {
        return reject({
          message: 'Android package name does not match Vella',
          status: 400,
          code: 'package_name_mismatch',
        });
      }
      verified = await verifyGooglePlaySubscription({
        packageName: configuredPackageName,
        subscriptionId: productId,
        purchaseToken: receiptData!,
      });
    }

    if (!verified) {
      return reject({
        message: 'Receipt could not be verified',
        status: 402,
        code: 'receipt_invalid',
      });
    }

    // The store-verified product must match what the client claimed it bought.
    if (verified.productId && verified.productId !== productId) {
      return reject({
        message: 'Product mismatch between receipt and request',
        status: 400,
        code: 'product_mismatch',
      });
    }

    // StoreKit returns the appAccountToken from the signed purchase. Never let
    // a transaction explicitly bound to one Vella account unlock another one;
    // recovery must go through the visible, authenticated transfer flow.
    if (
      platform === 'ios' &&
      !(await purchaseAccountCanBeClaimedByUser(verified, auth.userId, {
        currentUserIsAnonymous: auth.isAnonymous,
      }))
    ) {
      return reject({
        message: 'This store subscription is linked to another Vella account',
        status: 409,
        code: 'subscription_account_mismatch',
        source: 'entitlement_sync',
        retryable: false,
      });
    }

    const result = await syncIapEntitlement({
      requestId,
      userId: auth.userId,
      platform,
      purchaseToken: platform === 'android' ? receiptData : null,
      purchaseProof: proof,
      verified,
    });
    if ('error' in result) {
      const alreadyLinked = result.error === 'This store subscription is already linked to another Vella account';
      return reject({
        message: alreadyLinked
          ? 'This store subscription is linked to another Vella account'
          : 'Failed to record entitlement',
        status: alreadyLinked ? 409 : 503,
        code: alreadyLinked ? 'subscription_already_linked' : 'entitlement_sync_failed',
        source: 'entitlement_sync',
        retryable: !alreadyLinked,
      });
    }

    // Keep the recorded entitlement in sync, but never report an expired or
    // revoked purchase as a successful paywall unlock.
    if (!result.active) {
      return reject({
        message: 'Subscription is not active',
        status: 402,
        code: 'subscription_inactive',
        details: { expiresAt: result.endsAt },
      });
    }

    return ok({
      success: true,
      subscription: {
        status: 'premium',
        entitlement: result.entitlementCode,
        expiresAt: result.endsAt,
        autoRenew: verified.autoRenew,
        platform,
        billingPhase: verified.billingPhase,
        requestId,
      },
    });
  } catch (error) {
    console.error('[iap.validation] unexpected_failure', {
      requestId,
      platform,
      productId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return reject({
      message: 'Receipt validation is temporarily unavailable',
      status: 503,
      code: 'store_validation_unavailable',
      retryable: true,
    });
  }
}
