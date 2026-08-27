import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { canonicalTimeZone } from '@/lib/rhythms/practices';
import {
  saveGatheringProgressInputSchema,
  saveGatheringProgressV2,
} from '@/lib/rhythms/gatheringsV2';
import {
  recordGatheringOperationalEvent,
  type GatheringOperationalEventName,
  type SafeRequestProperties,
} from '@/lib/rhythms/gatheringOperationalTelemetry';
import type { GatheringSafeErrorCode } from '@/lib/rhythms/gatheringsV2';

type RouteParams = { params: Promise<{ templateId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function latencyBucket(startedAt: number) {
  const elapsed = Math.max(0, Date.now() - startedAt);
  if (elapsed < 100) return 'under_100ms' as const;
  if (elapsed < 500) return '100_499ms' as const;
  if (elapsed < 1_500) return '500_1499ms' as const;
  return '1500ms_plus' as const;
}

function record(
  eventName: GatheringOperationalEventName,
  outcome: 'success' | 'client_error' | 'server_error',
  startedAt: number,
  errorCode?: GatheringSafeErrorCode,
) {
  const properties: SafeRequestProperties = {
    route: 'progress_v2',
    outcome,
    latency_bucket: latencyBucket(startedAt),
    schema_version: 2,
    ...(errorCode ? { error_code: errorCode } : {}),
  };
  recordGatheringOperationalEvent(eventName, properties);
}

function invalidProgress() {
  return noStore(fail('Invalid Gathering progress', 400, { code: 'invalid_gathering_progress' }));
}

function accessErrorCode(response: Response) {
  if (response.status === 401) return 'authentication_required' as const;
  if (response.status === 402) return 'subscription_required' as const;
  if (response.status === 503) return 'subscription_check_unavailable' as const;
  return 'unknown' as const;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const startedAt = Date.now();
  record('api_progress_requested', 'success', startedAt);

  const access = await requireActiveSubscription();
  if ('response' in access) {
    record('api_progress_failed', 'client_error', startedAt, accessErrorCode(access.response));
    return noStore(access.response);
  }

  const { templateId } = await params;
  if (!UUID.test(templateId)) {
    record('api_progress_failed', 'client_error', startedAt, 'invalid_request');
    return invalidProgress();
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    record('api_progress_failed', 'client_error', startedAt, 'invalid_request');
    return invalidProgress();
  }
  const parsed = saveGatheringProgressInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    record('api_progress_failed', 'client_error', startedAt, 'invalid_request');
    return invalidProgress();
  }

  try {
    const result = await saveGatheringProgressV2(createServiceClient(), {
      userId: access.userId,
      templateId,
      currentStep: parsed.data.current_step,
      state: parsed.data.state,
      idempotencyKey: parsed.data.idempotency_key,
      timezoneName: canonicalTimeZone(parsed.data.timezone_name) ?? 'UTC',
    });
    if (!result.ok) {
      record('api_progress_failed', 'server_error', startedAt, result.code);
      return noStore(fail('Could not save Gathering progress', 503, { code: 'gathering_unavailable' }));
    }
    if (result.value.outcome === 'account_required') {
      record('api_progress_failed', 'client_error', startedAt, 'account_required');
      return noStore(fail('An account is required to save Gathering progress', 401, { code: 'account_required' }));
    }
    if (result.value.outcome === 'not_found') {
      record('api_progress_failed', 'client_error', startedAt, 'gathering_not_found');
      return noStore(fail('Gathering was not found', 404, { code: 'gathering_not_found' }));
    }
    if (result.value.outcome === 'idempotency_conflict') {
      record('api_progress_failed', 'client_error', startedAt, 'conflict');
      return noStore(fail('Gathering completion conflicts with an earlier operation', 409, {
        code: 'gathering_completion_conflict',
      }));
    }
    if (result.value.outcome === 'invalid_request') {
      record('api_progress_failed', 'client_error', startedAt, 'invalid_request');
      return invalidProgress();
    }
    record('api_progress_succeeded', 'success', startedAt);
    return noStore(ok(result.value));
  } catch {
    record('api_progress_failed', 'server_error', startedAt, 'database_unavailable');
    return noStore(fail('Could not save Gathering progress', 503, { code: 'gathering_unavailable' }));
  }
}
