import { fail, ok } from '@/lib/http';
import { loadMilestoneCabinet, type MilestoneClient } from '@/lib/rhythms/milestones';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET() {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);
  try {
    const client = createServiceClient() as unknown as MilestoneClient;
    return noStore(ok(await loadMilestoneCabinet(client, access.userId)));
  } catch {
    console.error('[rhythms-milestones]', {
      route: 'milestone_cabinet', stage: 'load', code: 'database_unavailable',
    });
    return noStore(fail('Could not load milestones', 503, { code: 'milestones_unavailable' }));
  }
}
