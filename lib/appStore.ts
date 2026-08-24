import type { VerifiedPurchase } from '@/lib/iap';
import { verifyAppleTransactionJws } from '@/lib/appleNotifications';

// Apple receipt verification via the server-authoritative verifyReceipt endpoint.
// The app sends its base64 app receipt; Apple returns the authoritative
// subscription state. We intentionally trust ONLY Apple's response — never any
// transaction fields the client claims. (MoodShift's version trusted a
// client-built JSON blob; this closes that hole.)

const PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

type AppleLatestInfo = {
  product_id: string;
  original_transaction_id: string;
  app_account_token?: string;
  expires_date_ms?: string;
  cancellation_date_ms?: string;
  auto_renew_status?: string;
  is_trial_period?: string;
};

type AppleResponse = {
  status: number;
  environment?: string;
  receipt?: {
    bundle_id?: string;
  };
  latest_receipt_info?: AppleLatestInfo[];
  pending_renewal_info?: Array<{
    product_id?: string;
    original_transaction_id?: string;
    auto_renew_status?: string;
  }>;
};

async function callApple(url: string, receiptData: string, sharedSecret: string): Promise<AppleResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    }),
  });
  return (await res.json()) as AppleResponse;
}

export async function verifyAppleReceipt(receiptData: string, expectedProductId?: string): Promise<VerifiedPurchase | null> {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) throw new Error('Missing APPLE_SHARED_SECRET');

  // Production first; on 21007 the receipt is from the sandbox, so retry there.
  let result = await callApple(PROD_URL, receiptData, sharedSecret);
  let environment: 'Production' | 'Sandbox' = 'Production';
  if (result.status === 21007) {
    result = await callApple(SANDBOX_URL, receiptData, sharedSecret);
    environment = 'Sandbox';
  }

  if (result.status !== 0) {
    console.warn('[iap.apple] receipt_rejected', { status: result.status, environment });
    return null;
  }

  // A valid Apple signature is not enough: bind the receipt to Vella so a
  // subscription bought in another app cannot unlock this one.
  const expectedBundleId = process.env.APPLE_BUNDLE_ID?.trim() || 'io.vella.app';
  if (result.receipt?.bundle_id !== expectedBundleId) {
    console.warn('[iap.apple] receipt_bundle_mismatch', { environment });
    return null;
  }

  const infos = (result.latest_receipt_info ?? []).filter((item) =>
    expectedProductId ? item.product_id === expectedProductId : true,
  );
  if (infos.length === 0) {
    console.warn('[iap.apple] receipt_product_missing', { expectedProductId, environment });
    return null;
  }

  // Most recent expiry wins (handles renewals within one receipt).
  const latest = infos.reduce((a, b) =>
    Number(b.expires_date_ms ?? 0) >= Number(a.expires_date_ms ?? 0) ? b : a,
  );

  const expiresMs = latest.cancellation_date_ms ? 0 : Number(latest.expires_date_ms ?? 0);
  const renewal = result.pending_renewal_info?.find((item) =>
    item.original_transaction_id === latest.original_transaction_id || item.product_id === latest.product_id,
  );
  return {
    productId: latest.product_id,
    originalTransactionId: latest.original_transaction_id,
    appAccountToken: latest.app_account_token ?? null,
    expiresAt: expiresMs ? new Date(expiresMs) : null,
    autoRenew: renewal?.auto_renew_status === '1',
    billingPhase: latest.is_trial_period === 'true' ? 'trial' : 'paid',
    environment,
    raw: result,
  };
}

/** Verify the StoreKit 2 transaction JWS rather than depending on a refreshed app receipt. */
export async function verifyAppleSignedTransaction(
  signedTransaction: string,
  expectedProductId?: string,
): Promise<VerifiedPurchase | null> {
  const { transaction, environment } = await verifyAppleTransactionJws(signedTransaction);
  if (!transaction.productId || !transaction.originalTransactionId) return null;
  if (expectedProductId && transaction.productId !== expectedProductId) return null;

  const expiresMs = transaction.revocationDate ? 0 : Number(transaction.expiresDate ?? 0);
  return {
    productId: transaction.productId,
    originalTransactionId: transaction.originalTransactionId,
    appAccountToken: transaction.appAccountToken ?? null,
    expiresAt: expiresMs ? new Date(expiresMs) : null,
    // Renewal state arrives authoritatively through App Store server notifications.
    autoRenew: !transaction.revocationDate,
    billingPhase: Number(transaction.offerType) === 1 ? 'trial' : 'paid',
    environment,
    raw: transaction,
  };
}
