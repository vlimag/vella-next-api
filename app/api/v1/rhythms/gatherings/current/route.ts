import { fail, ok } from '@/lib/http';
import {
  canonicalGatheringLocale,
  loadCurrentGathering,
  type GatheringClient,
} from '@/lib/rhythms/gatherings';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const locale = canonicalGatheringLocale(new URL(request.url).searchParams.get('locale'));
  const now = new Date().toISOString();
  try {
    const result = await loadCurrentGathering(createServiceClient() as unknown as GatheringClient, {
      userId: access.userId,
      locale,
      now,
    });
    if (!result.ok) {
      console.error('[gatherings]', {
        route: 'gathering_current', stage: 'load', code: result.code,
      });
      return noStore(fail('Could not load Gathering', 503, { code: 'gathering_unavailable' }));
    }
    return noStore(ok(result.value));
  } catch {
    console.error('[gatherings]', {
      route: 'gathering_current', stage: 'load', code: 'database_unavailable',
    });
    return noStore(fail('Could not load Gathering', 503, { code: 'gathering_unavailable' }));
  }
}
