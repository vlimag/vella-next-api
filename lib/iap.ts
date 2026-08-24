import { createServiceClient } from '@/lib/supabase';
import { recordValidIapReceipt, type IapBillingPhase } from '@/lib/iapAudit';

/**
 * Normalized, server-verified purchase — the shape both the Apple and Google
 * verifiers return. Never built from client-supplied fields.
 */
export type VerifiedPurchase = {
  productId: string;
  originalTransactionId: string;
  appAccountToken?: string | null;
  expiresAt: Date | null;
  autoRenew: boolean;
  billingPhase: IapBillingPhase;
  environment: string;
  raw: unknown;
};

/**
 * A verified Apple app-account token is an ownership assertion made when the
 * purchase was initiated. Legacy transactions may not have one, so the
 * database ownership lock remains the fallback for those purchases.
 */
export function purchaseAccountMatchesUser(verified: VerifiedPurchase, userId: string) {
  const token = verified.appAccountToken?.trim();
  return !token || token.toLowerCase() === userId.trim().toLowerCase();
}

export function toEntitlementCode(productId: string) {
  return productId.toLowerCase().includes('family') ? 'premium_family' : 'premium_individual';
}

type SyncResult =
  | { error: string }
  | { active: boolean; entitlementCode: string; endsAt: string | null; subscriptionId: string };

type AtomicSyncRow = {
  active: boolean;
  entitlement_code: string;
  ends_at: string | null;
  subscription_id: string | null;
  linked_to_other_account: boolean;
};

/**
 * Persist a verified IAP purchase into the shared subscriptions + entitlements
 * model. Idempotent on (provider, store_transaction_id).
 */
export async function syncIapEntitlement(params: {
  requestId: string;
  userId: string;
  platform: 'ios' | 'android';
  purchaseToken?: string | null;
  purchaseProof?: string | null;
  verified: VerifiedPurchase;
}): Promise<SyncResult> {
  const supabase = createServiceClient();
  const provider = params.platform === 'ios' ? 'apple' : 'google';
  const entitlementCode = toEntitlementCode(params.verified.productId);
  const active = params.verified.expiresAt ? params.verified.expiresAt.getTime() > Date.now() : true;
  const endsAtIso = params.verified.expiresAt ? params.verified.expiresAt.toISOString() : null;
  const storeTxnId = params.platform === 'android'
    ? params.purchaseToken ?? params.verified.originalTransactionId
    : params.verified.originalTransactionId;

  const { data, error } = await supabase
    .rpc('sync_iap_entitlement', {
      p_user_id: params.userId,
      p_provider: provider,
      p_store_product_id: params.verified.productId,
      p_store_transaction_id: storeTxnId,
      p_active: active,
      p_entitlement_code: entitlementCode,
      p_ends_at: endsAtIso,
      p_auto_renew: params.verified.autoRenew,
      p_platform: params.platform,
      p_environment: params.verified.environment,
      p_billing_phase: params.verified.billingPhase,
    })
    .maybeSingle();

  if (error) return { error: error.message };
  const synced = data as AtomicSyncRow | null;
  if (synced?.linked_to_other_account) {
    return { error: 'This store subscription is already linked to another Vella account' };
  }
  if (!synced?.subscription_id) return { error: 'Failed to synchronize subscription entitlement' };

  // Audit failure must never revoke access after the authoritative subscription
  // and entitlement were recorded. It is still surfaced as a structured server
  // error so operations can repair observability independently.
  await recordValidIapReceipt({
    requestId: params.requestId,
    userId: params.userId,
    platform: params.platform,
    productId: params.verified.productId,
    environment: params.verified.environment,
    originalTransactionId: params.verified.originalTransactionId,
    proof: params.purchaseProof,
    expiresAt: endsAtIso,
    autoRenew: params.verified.autoRenew,
    billingPhase: params.verified.billingPhase,
  });

  return {
    active: synced.active,
    entitlementCode: synced.entitlement_code,
    endsAt: synced.ends_at,
    subscriptionId: synced.subscription_id,
  };
}

/**
 * Update an existing IAP subscription's state from a store webhook
 * (renewal / expiry / refund). Looks the row up by store transaction id, so it
 * needs no user context. No-op if we've never seen the transaction.
 */
export async function updateIapSubscriptionState(params: {
  provider: 'apple' | 'google';
  storeTransactionId: string;
  active: boolean;
  endsAt: string | null;
  eventAt: string;
  autoRenew?: boolean;
}): Promise<{ updated: boolean; stale?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('apply_iap_subscription_state', {
    p_provider: params.provider,
    p_store_transaction_id: params.storeTransactionId,
    p_active: params.active,
    p_ends_at: params.endsAt,
    p_event_at: params.eventAt,
    p_auto_renew: params.autoRenew ?? null,
  }).maybeSingle();

  if (error) return { updated: false, error: error.message };
  const result = data as { updated?: boolean; stale?: boolean } | null;
  if (result?.updated) return { updated: true };
  return result?.stale
    ? { updated: false, stale: true }
    : { updated: false };
}
