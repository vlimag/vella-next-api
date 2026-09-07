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
  billingPhase: IapBillingPhase | null;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A different StoreKit appAccountToken can be recovered only from an
 * anonymous Supabase owner. Permanent identities always fail closed and the
 * database RPC independently arbitrates the transaction's persisted owner.
 */
export async function purchaseAccountCanBeClaimedByUser(
  verified: VerifiedPurchase,
  userId: string,
  options: { currentUserIsAnonymous?: boolean } = {},
) {
  if (purchaseAccountMatchesUser(verified, userId)) return true;

  // A verified store receipt may keep this installation unlocked after the
  // user signs out of Vella. The database grants only guest access here; it
  // never changes a permanent Vella account's canonical ownership.
  if (options.currentUserIsAnonymous === true) return true;

  const token = verified.appAccountToken?.trim();
  if (!token || !UUID_PATTERN.test(token)) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.getUserById(token);
  return !error && data.user?.is_anonymous === true;
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

function sevenArgumentWebhookRpcIsNotInstalled(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? '';
  const signature = 'faith_harbor.apply_iap_subscription_state(' +
    'p_active, p_auto_renew, p_billing_phase, p_ends_at, p_event_at, p_provider, p_store_transaction_id)';
  return error?.code === 'PGRST202' &&
    message.includes(`Could not find the function ${signature}`) &&
    message.includes('schema cache');
}

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

  const rpcParams = {
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
  };
  let syncResult = await supabase.rpc('sync_iap_entitlement', rpcParams).maybeSingle();

  // The staged API-first rollout can encounter the previous implementation of
  // this same eleven-argument function, which rejected a null phase. Retry only
  // that exact validation response so access is not blocked; the old database
  // has no transition table, and the migrated function accepts null directly.
  if (
    params.verified.billingPhase === null &&
    syncResult.error?.code === '22023' &&
    syncResult.error.message === 'billing_phase must be trial or paid'
  ) {
    syncResult = await supabase.rpc('sync_iap_entitlement', {
      ...rpcParams,
      p_billing_phase: 'paid',
    }).maybeSingle();
  }

  const { data, error } = syncResult;

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
 * needs no user context. Reports an unseen transaction as unlinked so the
 * verified webhook stays retryable until direct validation establishes owner.
 */
export async function updateIapSubscriptionState(params: {
  provider: 'apple' | 'google';
  storeTransactionId: string;
  active: boolean;
  endsAt: string | null;
  eventAt: string;
  autoRenew?: boolean;
  billingPhase: IapBillingPhase | null;
}): Promise<{ updated: boolean; stale?: boolean; unlinked?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const sevenArgumentParams = {
    p_provider: params.provider,
    p_store_transaction_id: params.storeTransactionId,
    p_active: params.active,
    p_ends_at: params.endsAt,
    p_event_at: params.eventAt,
    p_auto_renew: params.autoRenew ?? null,
    p_billing_phase: params.billingPhase,
  };
  let result = await supabase
    .rpc('apply_iap_subscription_state', sevenArgumentParams)
    .maybeSingle();

  // This narrowly-scoped compatibility path permits the API-first rollout:
  // once PostgREST can resolve the seven-argument function it never executes.
  if (sevenArgumentWebhookRpcIsNotInstalled(result.error)) {
    result = await supabase.rpc('apply_iap_subscription_state', {
      p_provider: params.provider,
      p_store_transaction_id: params.storeTransactionId,
      p_active: params.active,
      p_ends_at: params.endsAt,
      p_event_at: params.eventAt,
      p_auto_renew: params.autoRenew ?? null,
    }).maybeSingle();
  }

  if (result.error) return { updated: false, error: result.error.message };
  const state = result.data as {
    updated?: boolean;
    stale?: boolean;
    subscription_id?: string | null;
  } | null;
  const linkedSubscription = typeof state?.subscription_id === 'string' &&
    state.subscription_id.trim().length > 0;
  if (state?.updated === true && state.stale === false && linkedSubscription) {
    return { updated: true };
  }
  if (state?.updated === false && state.stale === true && linkedSubscription) {
    return { updated: false, stale: true };
  }
  if (state?.updated === false && state.stale === false && state.subscription_id === null) {
    return { updated: false, unlinked: true };
  }
  return { updated: false, error: 'Invalid subscription state response' };
}
