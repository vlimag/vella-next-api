import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { canonicalTimeZone } from '@/lib/rhythms/practices';
import {
  canonicalGatheringLocale,
} from '@/lib/rhythms/gatherings';
import { loadGatheringCatalogV2 } from '@/lib/rhythms/gatheringsV2';
import {
  recordGatheringOperationalEvent,
  type GatheringOperationalEventName,
  type SafeRequestProperties,
} from '@/lib/rhythms/gatheringOperationalTelemetry';
import type { GatheringLocale, GatheringSafeErrorCode } from '@/lib/rhythms/gatheringsV2';

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

function accessErrorCode(response: Response) {
  if (response.status === 401) return 'authentication_required' as const;
  if (response.status === 402) return 'subscription_required' as const;
  if (response.status === 503) return 'subscription_check_unavailable' as const;
  return 'unknown' as const;
}

function record(
  eventName: GatheringOperationalEventName,
  route: 'catalog_v2',
  outcome: 'success' | 'client_error' | 'server_error',
  startedAt: number,
  locale?: GatheringLocale,
  errorCode?: GatheringSafeErrorCode,
) {
  const properties: SafeRequestProperties = {
    route,
    outcome,
    latency_bucket: latencyBucket(startedAt),
    schema_version: 2,
    ...(locale ? { locale } : {}),
    ...(errorCode ? { error_code: errorCode } : {}),
  };
  recordGatheringOperationalEvent(eventName, properties);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const locale = canonicalGatheringLocale(url.searchParams.get('locale'));
  const timezoneName = canonicalTimeZone(
    url.searchParams.get('timezone_name') ?? url.searchParams.get('timezone'),
  ) ?? 'UTC';
  record('api_catalog_requested', 'catalog_v2', 'success', startedAt, locale);

  const access = await requireActiveSubscription();
  if ('response' in access) {
    record('api_catalog_failed', 'catalog_v2', 'client_error', startedAt, locale, accessErrorCode(access.response));
    return noStore(access.response);
  }

  try {
    const result = await loadGatheringCatalogV2(createServiceClient(), {
      userId: access.userId,
      locale,
      timezoneName,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      record('api_catalog_failed', 'catalog_v2', 'server_error', startedAt, locale, result.code);
      return noStore(fail('Could not load Gathering catalog', 503, { code: 'gathering_unavailable' }));
    }
    record('api_catalog_succeeded', 'catalog_v2', 'success', startedAt, locale);
    return noStore(ok(result.value));
  } catch {
    record('api_catalog_failed', 'catalog_v2', 'server_error', startedAt, locale, 'database_unavailable');
    return noStore(fail('Could not load Gathering catalog', 503, { code: 'gathering_unavailable' }));
  }
}
