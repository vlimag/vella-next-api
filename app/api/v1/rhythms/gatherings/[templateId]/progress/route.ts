import { fail, ok } from '@/lib/http';
import { canonicalTimeZone } from '@/lib/rhythms/practices';
import {
  saveGatheringProgress,
  saveGatheringProgressInputSchema,
  type GatheringClient,
} from '@/lib/rhythms/gatherings';
import { localDateKey, localWeekStart } from '@/lib/rhythms/time';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

type RouteParams = { params: Promise<{ templateId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function invalidRequest() {
  return noStore(fail('Invalid Gathering progress', 400, { code: 'invalid_gathering_progress' }));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const { templateId } = await params;
  if (!UUID.test(templateId)) return invalidRequest();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = saveGatheringProgressInputSchema.safeParse(rawBody);
  if (!parsed.success) return invalidRequest();
  const timezone = canonicalTimeZone(parsed.data.timezone_name);
  if (!timezone) return invalidRequest();

  const now = new Date();
  try {
    const result = await saveGatheringProgress(createServiceClient() as unknown as GatheringClient, {
      userId: access.userId,
      templateId,
      currentStep: parsed.data.current_step,
      completed: parsed.data.completed,
      idempotencyKey: parsed.data.idempotency_key,
      timezoneName: timezone,
      localDay: localDateKey(now, timezone),
      localWeekStart: localWeekStart(now, timezone),
      occurredAt: now.toISOString(),
    });
    if (!result.ok) {
      console.error('[gatherings]', {
        route: 'gathering_progress', stage: 'save', code: result.code,
      });
      return noStore(fail('Could not save Gathering progress', 503, { code: 'gathering_unavailable' }));
    }
    if (result.value.outcome === 'not_found') {
      return noStore(fail('Gathering was not found', 404, { code: 'gathering_not_found' }));
    }
    if (result.value.outcome === 'idempotency_conflict') {
      return noStore(fail('Gathering completion conflicts with an earlier operation', 409, {
        code: 'gathering_completion_conflict',
      }));
    }
    if (result.value.outcome === 'invalid_request') return invalidRequest();
    return noStore(ok(result.value));
  } catch {
    console.error('[gatherings]', {
      route: 'gathering_progress', stage: 'save', code: 'database_unavailable',
    });
    return noStore(fail('Could not save Gathering progress', 503, { code: 'gathering_unavailable' }));
  }
}
