import { getUserIdFromAuthHeader } from '@/lib/auth';
import { userHasActivePremium } from '@/lib/entitlements';
import { fail } from '@/lib/http';

type SubscriptionAccessGranted = {
  userId: string;
};

type SubscriptionAccessDenied = {
  response: ReturnType<typeof fail>;
};

export type SubscriptionAccessResult = SubscriptionAccessGranted | SubscriptionAccessDenied;

/**
 * Central server-side gate for Vella's subscription-only product routes.
 *
 * Store trials create the same time-bounded premium entitlement as paid
 * subscriptions, so eligible trial users pass this gate until their entitlement
 * expires. Authentication alone never grants product access.
 */
export async function requireActiveSubscription(): Promise<SubscriptionAccessResult> {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) {
    return {
      response: fail(auth.error, 401, { code: 'authentication_required' }),
    };
  }

  try {
    if (await userHasActivePremium(auth.userId)) {
      return { userId: auth.userId };
    }
  } catch (error) {
    console.error('[subscription-access] entitlement_check_failed', {
      userId: auth.userId,
      error: error instanceof Error ? error.message : String(error),
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
