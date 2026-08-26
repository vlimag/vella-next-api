import { fail, ok } from '@/lib/http';
import {
  completeDirectPracticeSession,
  completePracticeSessionInputSchema,
  type PracticeSessionClient,
} from '@/lib/rhythms/practiceSessions';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function invalidRequest() {
  return noStore(fail('Invalid session request', 400, { code: 'invalid_session_request' }));
}

export async function POST(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = completePracticeSessionInputSchema.safeParse(rawBody);
  if (!parsed.success) return invalidRequest();

  try {
    const client = createServiceClient() as unknown as PracticeSessionClient;
    const result = await completeDirectPracticeSession(client, {
      userId: access.userId,
      sessionId: parsed.data.session_id,
      idempotencyKey: parsed.data.idempotency_key,
      completedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      console.error('[practice-sessions]', {
        route: 'practice_session_complete', stage: 'rpc', code: result.code,
      });
      return noStore(fail('Could not complete practice session', 503, { code: 'practice_session_unavailable' }));
    }
    if (result.value.outcome === 'not_found') {
      return noStore(fail('Practice session was not found', 404, { code: 'session_not_found' }));
    }
    if (result.value.outcome === 'cancelled') {
      return noStore(fail('Practice session was cancelled', 409, { code: 'session_cancelled' }));
    }
    if (result.value.outcome === 'idempotency_conflict') {
      return noStore(fail('Session completion conflicts with an earlier operation', 409, { code: 'session_completion_conflict' }));
    }
    if (result.value.outcome === 'invalid_request') return invalidRequest();
    return noStore(ok(result.value));
  } catch {
    console.error('[practice-sessions]', {
      route: 'practice_session_complete', stage: 'rpc', code: 'database_unavailable',
    });
    return noStore(fail('Could not complete practice session', 503, { code: 'practice_session_unavailable' }));
  }
}
