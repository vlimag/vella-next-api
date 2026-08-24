import { getUserIdFromAuthHeader } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { claimSubscriptionMarketingTransition } from '@/lib/subscriptionMarketingTransitions';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(_request: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return noStore(fail(auth.error, 401));

  try {
    const transition = await claimSubscriptionMarketingTransition(auth.userId);
    return noStore(ok({ transition }));
  } catch {
    return noStore(fail('Could not claim a subscription transition', 500));
  }
}
