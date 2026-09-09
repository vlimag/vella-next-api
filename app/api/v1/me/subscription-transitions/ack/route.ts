import { getUserIdFromAuthHeader } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import {
  acknowledgeSubscriptionMarketingTransition,
  transitionAcknowledgementSchema,
} from '@/lib/subscriptionMarketingTransitions';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: Request) {
  const auth = await getUserIdFromAuthHeader({ allowAnonymous: true });
  if (!('userId' in auth)) return noStore(fail(auth.error, 401));

  const parsed = transitionAcknowledgementSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return noStore(fail('Invalid subscription transition acknowledgement', 400));
  }

  try {
    const acknowledged = await acknowledgeSubscriptionMarketingTransition(
      auth.userId,
      parsed.data.transitionId,
    );
    if (!acknowledged) return noStore(fail('Subscription transition not found', 404));
    return noStore(ok({ acknowledged: true as const }));
  } catch {
    return noStore(fail('Could not acknowledge a subscription transition', 500));
  }
}
