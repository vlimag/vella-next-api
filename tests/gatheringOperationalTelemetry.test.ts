import { describe, expect, it, vi } from 'vitest';
import { recordGatheringOperationalEvent } from '@/lib/rhythms/gatheringOperationalTelemetry';

describe('Gathering API operational telemetry', () => {
  it('builds an allowlisted success event without private content or identifiers', () => {
    const event = recordGatheringOperationalEvent('api_catalog_succeeded', {
      route: 'catalog_v2',
      outcome: 'success',
      latency_bucket: 'under_100ms',
      schema_version: 2,
      locale: 'pt',
    });

    expect(event).toMatchObject({
      event_name: 'api_catalog_succeeded',
      properties: {
        route: 'catalog_v2',
        outcome: 'success',
        latency_bucket: 'under_100ms',
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/userId|templateId|title|body|database exploded/i);
  });

  it('rejects unknown event names, properties, and error text at the telemetry boundary', () => {
    expect(recordGatheringOperationalEvent('api_catalog_succeeded', {
      route: 'catalog_v2',
      outcome: 'success',
      latency_bucket: 'under_100ms',
      schema_version: 2,
      title: 'private prose',
    } as never)).toBeNull();
    expect(recordGatheringOperationalEvent('api_catalog_succeeded', {
      route: 'catalog_v2',
      outcome: 'success',
      latency_bucket: 'under_100ms',
      schema_version: 2,
      error_code: 'raw database exploded',
    } as never)).toBeNull();
    expect(recordGatheringOperationalEvent('not_an_api_event' as never, {
      route: 'catalog_v2',
      outcome: 'success',
      latency_bucket: 'under_100ms',
      schema_version: 2,
    })).toBeNull();
  });

  it('contains telemetry sink failures without throwing', () => {
    const sink = vi.fn(() => { throw new Error('sink unavailable'); });
    expect(() => recordGatheringOperationalEvent('api_progress_failed', {
      route: 'progress_v2',
      outcome: 'server_error',
      latency_bucket: '500_1499ms',
      schema_version: 2,
      error_code: 'database_unavailable',
    }, sink)).not.toThrow();
    expect(sink).toHaveBeenCalledOnce();
  });
});
