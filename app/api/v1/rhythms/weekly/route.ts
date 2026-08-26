import { fail, ok } from '@/lib/http';
import { loadWeeklySummary, parseWeekStart, type WeeklyClient } from '@/lib/rhythms/weekly';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const rawWeek = new URL(request.url).searchParams.get('week');
  const week = rawWeek === null ? undefined : parseWeekStart(rawWeek);
  if (rawWeek !== null && week === null) {
    return noStore(fail('Invalid week', 400, { code: 'invalid_week' }));
  }

  try {
    const client = createServiceClient() as unknown as WeeklyClient;
    return noStore(ok(await loadWeeklySummary(client, access.userId, week ?? undefined)));
  } catch {
    console.error('[rhythms-weekly]', {
      route: 'rhythms_weekly', stage: 'load', code: 'database_unavailable',
    });
    return noStore(fail('Could not load weekly summary', 503, { code: 'weekly_summary_unavailable' }));
  }
}
