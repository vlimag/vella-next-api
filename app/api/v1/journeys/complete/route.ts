import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { completeJourneySession } from '@/lib/rhythms/journeyCompletion';
import { localDateKey, localWeekStart, normalizeTimeZone } from '@/lib/rhythms/time';

const bodySchema = z.object({
  journey_id: z.string().uuid(),
  reflection_note: z.string().trim().max(1200).optional(),
  gratitude_note: z.string().trim().max(1200).optional(),
  timezone_name: z.unknown().optional(),
  idempotency_key: z.string().uuid().optional(),
});

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return noStore(parsed.error);

  const now = new Date();
  const timezoneName = normalizeTimeZone(parsed.data.timezone_name);
  let result: Awaited<ReturnType<typeof completeJourneySession>>;
  try {
    result = await completeJourneySession(createServiceClient(), {
      userId: access.userId,
      journeyId: parsed.data.journey_id,
      reflectionNote: parsed.data.reflection_note,
      gratitudeNote: parsed.data.gratitude_note,
      timezoneName,
      localDay: localDateKey(now, timezoneName),
      localWeekStart: localWeekStart(now, timezoneName),
      idempotencyKey: parsed.data.idempotency_key,
      completedAt: now.toISOString(),
    });
  } catch {
    console.error('[journeys-complete]', {
      route: 'journey_complete',
      stage: 'rpc',
      code: 'database_unavailable',
    });
    return noStore(fail('Could not complete journey', 500));
  }

  if (!result.ok) {
    console.error('[journeys-complete]', {
      route: 'journey_complete',
      stage: 'rpc',
      code: result.code,
    });
    return noStore(fail('Could not complete journey', 500));
  }

  if (result.value.outcome === 'not_found') return noStore(fail('Journey not found', 404));
  if (result.value.outcome === 'idempotency_conflict') {
    return noStore(fail('Completion request conflicts with an existing session', 409));
  }
  if (result.value.outcome === 'invalid_request') return noStore(fail('Could not complete journey', 500));

  const projection = {
    journey: result.value.journey,
    milestones: result.value.milestones,
    practice_credits: result.value.practice_credits,
    newly_earned_milestones: result.value.newly_earned_milestones,
    local_day: result.value.local_day,
  };

  if (result.value.outcome !== 'completed') {
    return noStore(ok({
      alreadyCompleted: result.value.already_completed,
      journey: {
        ...result.value.journey,
        user_id: access.userId,
        anonymous_profile_id: null,
      },
    }));
  }

  return noStore(ok({ completed: true, ...projection }));
}
