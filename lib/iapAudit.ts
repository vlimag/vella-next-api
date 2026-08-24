import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';

export type IapPlatform = 'ios' | 'android';
export type IapBillingPhase = 'trial' | 'paid';

export function purchaseProofFingerprint(proof: string | null | undefined) {
  const normalized = proof?.trim();
  return normalized ? createHash('sha256').update(normalized).digest('hex') : null;
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return 'unknown';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code ? code.slice(0, 32) : 'unknown';
}

export async function recordFailedIapAttempt(params: {
  requestId: string;
  userId: string;
  platform?: IapPlatform | null;
  productId?: string | null;
  source?: 'server_validation' | 'entitlement_sync';
  errorCode: string;
  proof?: string | null;
  retryable?: boolean;
  metadata?: Record<string, boolean | number | string | null>;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('failed_receipts').insert({
    request_id: params.requestId,
    user_id: params.userId,
    platform: params.platform ?? null,
    product_id: params.productId ?? null,
    source: params.source ?? 'server_validation',
    error_code: params.errorCode,
    proof_fingerprint: purchaseProofFingerprint(params.proof),
    retryable: params.retryable ?? false,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('[iap.audit] failed_attempt_write_failed', {
      requestId: params.requestId,
      errorCode: params.errorCode,
      databaseErrorCode: databaseErrorCode(error),
    });
    return false;
  }
  return true;
}

export async function recordValidIapReceipt(params: {
  requestId: string;
  userId: string;
  platform: IapPlatform;
  productId: string;
  environment: string;
  originalTransactionId: string;
  proof?: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  billingPhase: IapBillingPhase | null;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('in_app_purchase_receipts').upsert({
    request_id: params.requestId,
    user_id: params.userId,
    platform: params.platform,
    product_id: params.productId,
    environment: params.environment,
    original_transaction_id: params.originalTransactionId,
    proof_fingerprint: purchaseProofFingerprint(params.proof),
    expires_at: params.expiresAt,
    auto_renew_status: params.autoRenew,
    billing_phase: params.billingPhase,
    validation_status: 'valid',
  }, { onConflict: 'request_id' });

  if (error) {
    console.error('[iap.audit] valid_receipt_write_failed', {
      requestId: params.requestId,
      databaseErrorCode: databaseErrorCode(error),
    });
    return false;
  }
  return true;
}
