import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260828132000_checkout_lifecycle_telemetry.sql',
);

describe('checkout lifecycle telemetry migration', () => {
  it('is backward-compatible, finite, privacy-safe, and non-destructive', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    if (!fs.existsSync(migrationPath)) return;
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/growth_event_properties_are_safe_v10/i);
    expect(sql).toMatch(/p_event_name = 'checkout_started'/i);
    expect(sql).toMatch(
      /jsonb_build_object\(\s*'plan',[\s\S]*jsonb_build_object\(\s*'plan',[\s\S]*'attempt_id'/i,
    );
    expect(sql).toMatch(/p_event_name = 'checkout_result'/i);
    for (const value of ['succeeded', 'cancelled', 'failed', 'timed_out']) {
      expect(sql).toContain(`'${value}'`);
    }
    for (const value of ['store_request', 'store_callback', 'validation', 'access_refresh', 'unexpected']) {
      expect(sql).toContain(`'${value}'`);
    }
    expect(sql).toMatch(/growth_analytics_events_event_name_v10_check[\s\S]*'checkout_result'[\s\S]*not valid/i);
    expect(sql).toMatch(/validate constraint growth_analytics_events_event_name_v10_check/i);
    expect(sql).not.toMatch(/\b(update|delete|truncate)\b|insert\s+into\s+faith_harbor\.growth_analytics_events/i);
  });
});
