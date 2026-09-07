import { getUserIdFromAuthHeader } from '@/lib/auth';
import { userHasActivePremium } from '@/lib/entitlements';
import { fail } from '@/lib/http';

type SubscriptionAccessGranted = {
  userId: string;
  isAnonymous: boolean;
};

type SubscriptionAccessDenied = {
  response: ReturnType<typeof fail>;
};

export type SubscriptionAccessResult = SubscriptionAccessGranted | SubscriptionAccessDenied;

type ReadOnlyContentGranted = {
  userId: string | null;
  isAnonymous: boolean;
};

export type ReadOnlyContentAccessResult = ReadOnlyContentGranted | SubscriptionAccessDenied;

/**
 * Resolves an optional viewer for account-neutral, read-only content.
 *
 * Vella Premium can be purchased and used without creating a permanent Vella
 * account. The app enforces the device's store entitlement, while these GET
 * routes expose only non-account-specific content. A malformed bearer still
 * fails closed instead of silently becoming a signed-out viewer.
 */
export async function resolveReadOnlyContentViewer(): Promise<ReadOnlyContentAccessResult> {
  const auth = await getUserIdFromAuthHeader({ allowAnonymous: true });
  if ('userId' in auth) {
    return { userId: auth.userId, isAnonymous: auth.isAnonymous };
  }
  if (auth.error === 'Missing bearer token') {
    return { userId: null, isAnonymous: true };
  }
  return {
    response: fail(auth.error, 401, { code: 'authentication_required' }),
  };
}

/**
 * Central server-side gate for Vella's subscription-only product routes.
 *
 * Store trials create the same time-bounded premium entitlement as paid
 * subscriptions, so eligible trial users pass this gate until their entitlement
 * expires. Authentication alone never grants product access.
 */
export async function requireActiveSubscription(): Promise<SubscriptionAccessResult> {
  const auth = await getUserIdFromAuthHeader({ allowAnonymous: true });
  if (!('userId' in auth)) {
    return {
      response: fail(auth.error, 401, { code: 'authentication_required' }),
    };
  }

  try {
    if (await userHasActivePremium(auth.userId, { isAnonymous: auth.isAnonymous })) {
      return { userId: auth.userId, isAnonymous: auth.isAnonymous };
    }
  } catch {
    console.error('[subscription-access]', {
      route: 'subscription_access',
      stage: 'entitlement_check',
      code: 'entitlement_unavailable',
    });

    return {
      response: fail('Could not verify subscription access', 503, {
        code: 'subscription_check_unavailable',
      }),
    };
  }

  return {
    response: fail('An active Vella Premium subscription is required', 402, {
      code: 'subscription_required',
    }),
  };
}
