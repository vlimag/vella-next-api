import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { growthEventSchema } from '@/lib/growthAnalytics';

const extensionPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260826170015_extend_rhythm_milestone_telemetry.sql',
);

const event = (catalogCode: string) => ({
  event_id: '11111111-1111-4111-8111-111111111111',
  install_id: '22222222-2222-4222-8222-222222222222',
  event_name: 'milestone_earned',
  occurred_at: '2026-08-26T00:00:00.000Z',
  platform: 'android',
  app_version: '2.0.0',
  properties: { catalog_code: catalogCode },
});

describe('recurring-practice milestone telemetry extension', () => {
  it.each([
    'rhythm_first_week',
    'rhythm_four_weeks',
    'rhythm_balanced',
    'rhythm_return',
  ])('accepts the finite %s catalog code across the API contract', (catalogCode) => {
    expect(growthEventSchema.safeParse(event(catalogCode)).success).toBe(true);
  });

  it('continues to reject arbitrary milestone codes and private extras', () => {
    expect(growthEventSchema.safeParse(event('private-prayer-about-someone')).success).toBe(false);
    expect(growthEventSchema.safeParse({
      ...event('rhythm_first_week'),
      properties: { catalog_code: 'rhythm_first_week', user_id: 'private' },
    }).success).toBe(false);
  });

  it('uses an additive v9 validator, preserves legacy rows, and narrows execution ACLs', () => {
    const migration = fs.readFileSync(extensionPath, 'utf8');
    expect(migration).toContain('growth_event_properties_are_safe_v9');
    expect(migration).toContain('growth_event_properties_are_safe_v8(p_event_name, p_properties)');
    expect(migration).toContain("'rhythm_first_week', 'rhythm_four_weeks', 'rhythm_balanced', 'rhythm_return'");
    expect(migration).toMatch(/add constraint growth_analytics_properties_v9_check[\s\S]*not valid;/i);
    expect(migration).not.toMatch(/validate constraint growth_analytics_properties_v9_check;/i);
    expect(migration).toMatch(/drop constraint growth_analytics_properties_check;/i);
    expect(migration).toMatch(/rename constraint growth_analytics_properties_v9_check to growth_analytics_properties_check;/i);
    expect(migration).toMatch(/revoke execute on function faith_harbor\.growth_event_properties_are_safe_v9\(text, jsonb\)[\s\S]*from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant execute on function faith_harbor\.growth_event_properties_are_safe_v9\(text, jsonb\)[\s\S]*to service_role;/i);
    expect(migration).not.toMatch(/security definer|grant[^;]*on (?:table|schema)|enable row level security/i);
  });
});
