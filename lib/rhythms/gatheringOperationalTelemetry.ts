import { z } from 'zod';
import {
  GATHERING_SAFE_ERROR_CODES,
  GATHERING_V2_LOCALES,
  type GatheringLocale,
  type GatheringSafeErrorCode,
} from '@/lib/rhythms/gatheringsV2';

export const GATHERING_OPERATIONAL_EVENT_NAMES = [
  'api_catalog_requested',
  'api_catalog_succeeded',
  'api_catalog_failed',
  'api_progress_requested',
  'api_progress_succeeded',
  'api_progress_failed',
] as const;
export type GatheringOperationalEventName = typeof GATHERING_OPERATIONAL_EVENT_NAMES[number];

export const safeRequestPropertiesSchema = z.object({
  route: z.enum(['catalog_v2', 'progress_v2']),
  outcome: z.enum(['success', 'client_error', 'server_error']),
  latency_bucket: z.enum(['under_100ms', '100_499ms', '500_1499ms', '1500ms_plus']),
  schema_version: z.literal(2),
  locale: z.enum(GATHERING_V2_LOCALES).optional(),
  error_code: z.enum(GATHERING_SAFE_ERROR_CODES).optional(),
}).strict();

export type SafeRequestProperties = {
  route: 'catalog_v2' | 'progress_v2';
  outcome: 'success' | 'client_error' | 'server_error';
  latency_bucket: 'under_100ms' | '100_499ms' | '500_1499ms' | '1500ms_plus';
  schema_version: 2;
  locale?: GatheringLocale;
  error_code?: GatheringSafeErrorCode;
};

export type GatheringOperationalEvent = {
  event_name: GatheringOperationalEventName;
  properties: SafeRequestProperties;
};

type EventSink = (event: GatheringOperationalEvent) => void;

function defaultEventSink(event: GatheringOperationalEvent) {
  console.info('[gathering-api]', event);
}

function parseEvent(
  eventName: unknown,
  properties: unknown,
): GatheringOperationalEvent | null {
  if (typeof eventName !== 'string' || !GATHERING_OPERATIONAL_EVENT_NAMES.includes(
    eventName as GatheringOperationalEventName,
  )) return null;
  const parsed = safeRequestPropertiesSchema.safeParse(properties);
  if (!parsed.success) return null;
  return {
    event_name: eventName as GatheringOperationalEventName,
    properties: parsed.data,
  };
}

/**
 * Creates a finite API event and schedules its default sink after the caller
 * returns. A supplied sink is used synchronously for deterministic tests and
 * alternate server telemetry integrations; sink failures are always ignored.
 */
export function recordGatheringOperationalEvent(
  eventName: GatheringOperationalEventName,
  properties: SafeRequestProperties,
  sink?: EventSink,
): GatheringOperationalEvent | null {
  const event = parseEvent(eventName, properties);
  if (!event) return null;

  if (sink) {
    try {
      sink(event);
    } catch {
      // Telemetry must never affect the devotional request.
    }
  } else {
    queueMicrotask(() => {
      try {
        defaultEventSink(event);
      } catch {
        // Console/provider failures are intentionally contained.
      }
    });
  }
  return event;
}
