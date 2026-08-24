import crypto from 'node:crypto';
import type { VerifiedPurchase } from '@/lib/iap';
import type { IapBillingPhase } from '@/lib/iapAudit';
import { vellaSubscriptionPlan } from '@/lib/iapProducts';

// Google Play subscription verification via the Play Developer API. We mint an
// OAuth2 access token from a service account (RS256 JWT, no extra deps) and ask
// Google for the authoritative subscription state for a purchase token.

type ServiceAccount = { client_email: string; private_key: string };

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (need client_email + private_key)');
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google OAuth token exchange failed');
  return json.access_token;
}

export type PlaySubscriptionV2 = {
  subscriptionState?: string;
  startTime?: string;
  testPurchase?: Record<string, never>;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    latestSuccessfulOrderId?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: { offerId?: string };
    offerPhase?: {
      prorationPeriod?: Record<string, unknown>;
      freeTrial?: Record<string, unknown>;
      introductoryPrice?: Record<string, unknown>;
      basePrice?: Record<string, unknown>;
    };
  }>;
};

export type GooglePlaySubscriptionState = {
  active: boolean;
  productId: string | null;
  expiresAt: Date | null;
  autoRenew: boolean;
  billingPhase: IapBillingPhase | null;
  environment: 'Test' | 'Production';
  raw: PlaySubscriptionV2;
};

const ACCESS_GRANTING_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  // Canceling turns auto-renew off but access remains valid until expiry.
  'SUBSCRIPTION_STATE_CANCELED',
]);

const SUCCESSFUL_PAID_PHASE_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_CANCELED',
]);

/**
 * Derive only Vella's coarse billing phase from Google's authoritative current
 * offer-phase union. Offer IDs and date arithmetic are not payment evidence.
 */
export function billingPhaseFromPlaySubscription(
  subscription: PlaySubscriptionV2,
  item: NonNullable<PlaySubscriptionV2['lineItems']>[number],
): IapBillingPhase | null {
  if (!item.productId || !vellaSubscriptionPlan(item.productId)) return null;
  if (subscription.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return null;
  if (item.offerPhase?.freeTrial !== undefined) return 'trial';
  if (
    item.offerPhase?.basePrice !== undefined &&
    Boolean(item.latestSuccessfulOrderId?.trim()) &&
    SUCCESSFUL_PAID_PHASE_STATES.has(subscription.subscriptionState ?? '')
  ) {
    return 'paid';
  }
  return null;
}

export function subscriptionStateFromPlaySubscription(
  subscription: PlaySubscriptionV2,
  allowedProductIds: ReadonlySet<string>,
  nowMs = Date.now(),
): GooglePlaySubscriptionState | null {
  const matchingItems = (subscription.lineItems ?? []).filter(
    (item) => item.productId && allowedProductIds.has(item.productId),
  );
  if (matchingItems.length === 0) return null;

  const datedItems = matchingItems
    .map((item) => ({ item, expiresMs: Date.parse(item.expiryTime ?? '') }))
    .filter(({ expiresMs }) => Number.isFinite(expiresMs))
    .sort((a, b) => b.expiresMs - a.expiresMs);
  const latest = datedItems[0];
  const expiresAt = latest ? new Date(latest.expiresMs) : null;
  const active = ACCESS_GRANTING_STATES.has(subscription.subscriptionState ?? '') &&
    Boolean(latest && latest.expiresMs > nowMs);

  return {
    active,
    productId: latest?.item.productId ?? matchingItems[0]?.productId ?? null,
    expiresAt,
    autoRenew: matchingItems.some((item) => item.autoRenewingPlan?.autoRenewEnabled === true),
    billingPhase: billingPhaseFromPlaySubscription(subscription, latest?.item ?? matchingItems[0]!),
    environment: subscription.testPurchase ? 'Test' : 'Production',
    raw: subscription,
  };
}

export function verifiedPurchaseFromPlaySubscription(
  subscription: PlaySubscriptionV2,
  expectedProductId: string,
  purchaseToken: string,
  nowMs = Date.now(),
): VerifiedPurchase | null {
  const state = subscriptionStateFromPlaySubscription(
    subscription,
    new Set([expectedProductId]),
    nowMs,
  );
  if (!state?.active || !state.expiresAt) return null;

  const matchingItems = (subscription.lineItems ?? []).filter(
    (item) => item.productId === expectedProductId,
  );
  const latest = matchingItems
    .filter((item) => Number.isFinite(Date.parse(item.expiryTime ?? '')))
    .sort((a, b) => Date.parse(b.expiryTime ?? '') - Date.parse(a.expiryTime ?? ''))[0];
  if (!latest) return null;

  return {
    productId: expectedProductId,
    originalTransactionId: latest.latestSuccessfulOrderId ?? purchaseToken,
    expiresAt: state.expiresAt,
    autoRenew: state.autoRenew,
    billingPhase: billingPhaseFromPlaySubscription(subscription, latest),
    environment: state.environment,
    raw: subscription,
  };
}

class GooglePlayApiError extends Error {
  constructor(readonly status: number) {
    super(`Google Play Developer API request failed (${status})`);
  }
}

export async function getGooglePlaySubscription(params: {
  packageName: string;
  purchaseToken: string;
}): Promise<PlaySubscriptionV2> {
  if (!params.packageName) throw new Error('Missing Android package name');

  const token = await getAccessToken(loadServiceAccount());
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(params.packageName)}/purchases/subscriptionsv2/tokens/` +
    encodeURIComponent(params.purchaseToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new GooglePlayApiError(res.status);
  return (await res.json()) as PlaySubscriptionV2;
}

export async function verifyGooglePlaySubscription(params: {
  packageName: string;
  subscriptionId: string;
  purchaseToken: string;
}): Promise<VerifiedPurchase | null> {
  try {
    const sub = await getGooglePlaySubscription(params);
    return verifiedPurchaseFromPlaySubscription(sub, params.subscriptionId, params.purchaseToken);
  } catch (error) {
    // Bad/unknown purchase tokens are a validation failure. Authentication,
    // quota, and upstream outages must surface so webhook delivery is retried.
    if (error instanceof GooglePlayApiError && [400, 404, 410].includes(error.status)) return null;
    throw error;
  }
}

type PubSubAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Verify the Google-signed OIDC token attached to an authenticated Pub/Sub push. */
export async function verifyGooglePubSubRequest(authorizationHeader: string | null): Promise<PubSubAuthResult> {
  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE?.trim();
  const expectedEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!audience || !expectedEmail) {
    return { ok: false, status: 503, error: 'Google Pub/Sub authentication is not configured' };
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorizationHeader ?? '');
  const idToken = match?.[1];
  if (!idToken || idToken.length > 8192) {
    return { ok: false, status: 401, error: 'Missing Pub/Sub bearer token' };
  }

  try {
    const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
    tokenInfoUrl.searchParams.set('id_token', idToken);
    const response = await fetch(tokenInfoUrl, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        return { ok: false, status: 503, error: 'Could not verify Pub/Sub bearer token' };
      }
      return { ok: false, status: 401, error: 'Invalid Pub/Sub bearer token' };
    }

    const claims = (await response.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      exp?: string;
      iss?: string;
    };
    const issuerValid = claims.iss === 'accounts.google.com' || claims.iss === 'https://accounts.google.com';
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    const expiresAtSeconds = Number(claims.exp ?? 0);
    if (
      !issuerValid ||
      !emailVerified ||
      claims.aud !== audience ||
      claims.email !== expectedEmail ||
      !Number.isFinite(expiresAtSeconds) ||
      expiresAtSeconds * 1000 <= Date.now()
    ) {
      return { ok: false, status: 401, error: 'Invalid Pub/Sub token claims' };
    }

    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: 'Could not verify Pub/Sub bearer token' };
  }
}
