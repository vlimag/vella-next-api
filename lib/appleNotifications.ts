import {
  AutoRenewStatus,
  Environment,
  SignedDataVerifier,
  Status,
  type JWSTransactionDecodedPayload,
  type JWSRenewalInfoDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { APPLE_ROOT_CERTIFICATES } from '@/lib/appleRootCertificates';

const DEFAULT_BUNDLE_ID = 'io.vella.app';
const DEFAULT_APP_APPLE_ID = 6_790_616_297;

const INACTIVE_NOTIFICATION_TYPES = new Set([
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'REFUND',
  'REVOKE',
]);

type VerifiedAppleNotification = {
  notification: ResponseBodyV2DecodedPayload;
  transaction: JWSTransactionDecodedPayload | null;
  renewal: JWSRenewalInfoDecodedPayload | null;
};

export type VerifiedAppleTransaction = {
  transaction: JWSTransactionDecodedPayload;
  environment: 'Production' | 'Sandbox';
};

type AppleSubscriptionUpdate = {
  originalTransactionId: string;
  productId: string;
  active: boolean;
  endsAt: string | null;
  eventAt: string;
  autoRenew?: boolean;
};

let productionVerifier: SignedDataVerifier | null = null;
let sandboxVerifier: SignedDataVerifier | null = null;

function appleIdentity() {
  const bundleId = process.env.APPLE_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID;
  const appAppleId = Number(process.env.APPLE_APP_ID ?? DEFAULT_APP_APPLE_ID);
  if (!Number.isSafeInteger(appAppleId) || appAppleId <= 0) {
    throw new Error('APPLE_APP_ID must be a positive integer');
  }
  return { bundleId, appAppleId };
}

function verifierFor(environment: Environment.PRODUCTION | Environment.SANDBOX) {
  const { bundleId, appAppleId } = appleIdentity();
  if (environment === Environment.PRODUCTION) {
    productionVerifier ??= new SignedDataVerifier(
      APPLE_ROOT_CERTIFICATES,
      true,
      Environment.PRODUCTION,
      bundleId,
      appAppleId,
    );
    return productionVerifier;
  }

  sandboxVerifier ??= new SignedDataVerifier(
    APPLE_ROOT_CERTIFICATES,
    true,
    Environment.SANDBOX,
    bundleId,
  );
  return sandboxVerifier;
}

/** Verify a StoreKit 2 transaction JWS returned directly by expo-iap. */
export async function verifyAppleTransactionJws(signedTransaction: string): Promise<VerifiedAppleTransaction> {
  let lastError: unknown;

  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX] as const) {
    try {
      const transaction = await verifierFor(environment).verifyAndDecodeTransaction(signedTransaction);
      return {
        transaction,
        environment: environment === Environment.PRODUCTION ? 'Production' : 'Sandbox',
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Apple transaction signature verification failed', { cause: lastError });
}

/** Verify the outer notification and both nested signed objects against Apple. */
export async function verifyAppleNotification(signedPayload: string): Promise<VerifiedAppleNotification> {
  let lastError: unknown;

  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX] as const) {
    const verifier = verifierFor(environment);
    try {
      const notification = await verifier.verifyAndDecodeNotification(signedPayload);
      const transaction = notification.data?.signedTransactionInfo
        ? await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo)
        : null;
      const renewal = notification.data?.signedRenewalInfo
        ? await verifier.verifyAndDecodeRenewalInfo(notification.data.signedRenewalInfo)
        : null;
      return { notification, transaction, renewal };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Apple notification signature verification failed', { cause: lastError });
}

/** Convert verified Apple status fields into the entitlement state we persist. */
export function deriveAppleSubscriptionUpdate(
  verified: VerifiedAppleNotification,
  nowMs = Date.now(),
): AppleSubscriptionUpdate | null {
  const { notification, transaction, renewal } = verified;
  const originalTransactionId = transaction?.originalTransactionId ?? renewal?.originalTransactionId;
  const productId = transaction?.productId ?? renewal?.productId;
  const signedAtMs = notification.signedDate ?? transaction?.signedDate ?? renewal?.signedDate;
  if (!originalTransactionId || !productId || !Number.isFinite(signedAtMs)) return null;

  const status = notification.data?.status;
  const graceEndsMs = renewal?.gracePeriodExpiresDate;
  const normalEndsMs = transaction?.expiresDate ?? renewal?.renewalDate;
  const effectiveEndsMs = status === Status.BILLING_GRACE_PERIOD && graceEndsMs
    ? graceEndsMs
    : normalEndsMs;
  const endsAt = effectiveEndsMs ? new Date(effectiveEndsMs).toISOString() : null;

  const notificationType = String(notification.notificationType ?? '');
  // REFUND_REVERSED must reinstate access for the remaining paid period, even
  // if the transaction snapshot still contains historical revocation fields.
  const refundReversed = notificationType === 'REFUND_REVERSED';
  const explicitlyInactive = !refundReversed && (
    INACTIVE_NOTIFICATION_TYPES.has(notificationType) ||
    Boolean(transaction?.revocationDate) ||
    status === Status.EXPIRED ||
    status === Status.REVOKED
  );

  const active = !explicitlyInactive && Boolean(effectiveEndsMs && effectiveEndsMs > nowMs);

  return {
    originalTransactionId,
    productId,
    active,
    endsAt,
    eventAt: new Date(signedAtMs as number).toISOString(),
    ...(typeof renewal?.autoRenewStatus === 'number'
      ? { autoRenew: renewal.autoRenewStatus === AutoRenewStatus.ON }
      : {}),
  };
}
