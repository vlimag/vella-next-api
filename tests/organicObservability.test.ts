import { describe, expect, it } from 'vitest';
import { growthEventSchema } from '@/lib/growthAnalytics';

const event = { event_id: '11111111-1111-4111-8111-111111111111', install_id: '22222222-2222-4222-8222-222222222222', occurred_at: '2026-10-18T12:00:00Z', platform: 'android', app_version: '1.0.1', event_name: 'first_open', properties: {} };
describe('organic release diagnostics ingestion contract', () => {
  it('bounds public website sources and content without narrowing native campaign attribution', () => {
    const web = { ...event, platform: 'web', event_name: 'landing_viewed', properties: { source: 'search', content: 'guide_bible_start' } };
    expect(growthEventSchema.safeParse(web).success).toBe(true);
    expect(growthEventSchema.safeParse({ ...web, properties: { source: 'direct', content: 'blog_article' } }).success).toBe(true);
    expect(growthEventSchema.safeParse({ ...web, properties: {} }).success).toBe(true);
    for (const properties of [{ source: 'personal_name' }, { content: 'private_prayer' }]) {
      expect(growthEventSchema.safeParse({ ...web, properties }).success).toBe(false);
    }
    expect(growthEventSchema.safeParse({ ...event, properties: { source: 'google', content: 'search.guide_bible_start.blog-article' } }).success).toBe(true);
  });
  it('accepts immutable OTA context and legacy context-free events', () => {
    expect(growthEventSchema.safeParse(event).success).toBe(true);
    const contextual = { ...event, update_id: '33333333-3333-4333-8333-333333333333', traffic_type: 'test' };
    expect(growthEventSchema.parse(contextual)).toEqual(contextual);
  });
  it('rejects private or malformed metadata', () => {
    for (const extra of [{ update_id: 'secret-url' }, { update_id: null }, { traffic_type: 'person@example.com' }, { traffic_type: null }]) {
      expect(growthEventSchema.safeParse({ ...event, ...extra }).success).toBe(false);
    }
  });
  it('accepts only finite preview diagnostics and keeps old payloads', () => {
    const error = { ...event, event_name: 'first_experience_error', properties: { stage: 'content_load', error_code: 'network_unavailable', reason_code: 'timeout', duration_bucket: '5_9s', attempt_count: 1 } };
    expect(growthEventSchema.safeParse(error).success).toBe(true);
    for (const extra of [{ reason_code: 'raw message' }, { attempt_count: 3 }, { attempt_count: 1.5 }, { duration_bucket: 'invalid' }, { raw_error: 'secret' }]) {
      expect(growthEventSchema.safeParse({ ...error, properties: { ...error.properties, ...extra } }).success).toBe(false);
    }
  });
});
