import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { growthEventSchema } from '@/lib/growthAnalytics';

const RHYTHMS_EVENTS = [
  'rhythms_hub_viewed',
  'journey_catalog_viewed',
  'journey_detail_viewed',
  'journey_started',
  'practice_catalog_viewed',
  'practice_selected',
  'weekly_rhythm_saved',
  'gathering_viewed',
  'journey_session_started',
  'journey_step_completed',
  'journey_session_completed',
  'journey_resumed',
  'practice_session_started',
  'practice_session_completed',
  'practice_session_abandoned',
  'gathering_started',
  'gathering_step_completed',
  'gathering_resumed',
  'gathering_completed',
  'journey_completed',
  'journey_completion_viewed',
  'journey_next_selected',
  'weekly_rhythm_completed',
  'weekly_rhythm_returned',
  'milestone_earned',
  'milestone_revealed',
  'milestone_featured',
  'milestone_unfeatured',
  'milestone_shared',
  'rhythms_load_failed',
  'rhythms_mutation_failed',
  'session_completion_conflict',
  'rhythms_asset_fallback_used',
] as const;

function telemetryMigration() {
  const directory = path.resolve(process.cwd(), '../supabase/migrations');
  const matches = fs.readdirSync(directory)
    .filter((name) => name.endsWith('_vella_rhythms_telemetry.sql'));
  expect(matches).toHaveLength(1);
  if (matches.length !== 1) return '';
  return fs.readFileSync(path.join(directory, matches[0]!), 'utf8');
}

function postgresIntegrationHarness() {
  return fs.readFileSync(path.resolve(process.cwd(), 'tests/rhythmsTelemetryPostgres.integration.sh'), 'utf8');
}

describe('Vella Rhythms telemetry migration contract', () => {
  it('keeps the behavioral PostgreSQL fixture equivalent to all cross-layer event and privacy contracts', () => {
    const harness = postgresIntegrationHarness();
    for (const eventName of RHYTHMS_EVENTS) {
      expect(harness).toContain(`('${eventName}', '{`);
    }
    for (const forbiddenKey of [
      'campaign', 'user_id', 'install_id', 'account_id', 'content', 'reflection_text',
      'gratitude_note', 'raw_error',
    ]) {
      expect(harness).toContain(`'${forbiddenKey}'`);
    }
    expect(harness).toContain('wrong property type accepted');
    expect(harness).toContain('arbitrary catalog accepted');
    expect(harness).toContain('invalid schema/capability accepted');
    expect(harness).toContain('v7 delegation behavior changed');

    const acceptedBlock = harness.match(
      /insert into accepted_rhythms_contracts values([\s\S]*?);\n\n  if \(select count\(\*\)/,
    )?.[1] ?? '';
    const fixtures = [...acceptedBlock.matchAll(/\('([^']+)', '(\{[^\n]+\})'\)/g)]
      .map((match) => ({ eventName: match[1]!, properties: JSON.parse(match[2]!) }));
    expect(fixtures).toHaveLength(RHYTHMS_EVENTS.length);
    for (const fixture of fixtures) {
      expect(growthEventSchema.safeParse({
        event_id: '11111111-1111-4111-8111-111111111111',
        install_id: '22222222-2222-4222-8222-222222222222',
        event_name: fixture.eventName,
        occurred_at: '2026-08-26T00:00:00.000Z',
        platform: 'android',
        app_version: '2.0.0',
        properties: fixture.properties,
      }).success).toBe(true);
    }
  });

  it('allows every approved event and delegates every non-Rhythms event to v7', () => {
    const migration = telemetryMigration();
    for (const eventName of RHYTHMS_EVENTS) {
      expect(migration).toContain(`'${eventName}'`);
    }
    expect(migration).toMatch(/create or replace function faith_harbor\.growth_event_properties_are_safe_v8/);
    expect(migration).toMatch(/else faith_harbor\.growth_event_properties_are_safe_v7\(p_event_name, p_properties\)/);
  });

  it('uses exact Rhythms JSON schemas and finite validators rather than permissive keys', () => {
    const migration = telemetryMigration();
    for (const eventName of RHYTHMS_EVENTS) {
      expect(migration).toMatch(new RegExp(`when p_event_name = '${eventName}' then[\\s\\S]*?p_properties = jsonb_build_object`));
    }
    expect(migration).toMatch(/p_properties ->> 'catalog_code' in \([\s\S]*'hope-in-seven'[\s\S]*'guided_prayer'[\s\S]*'journey_finisher'/);
    expect(migration).toMatch(/jsonb_typeof\(p_properties -> 'step_index'\) = 'number'/);
    expect(migration).not.toMatch(/step_index[^\n]*::integer/);
    expect(migration).toMatch(/p_properties ->> 'schema_version' = '1'/);
    expect(migration).toMatch(/p_properties ->> 'error_code' in \([\s\S]*'network_unavailable'[\s\S]*'asset_unavailable'/);
    expect(migration).not.toMatch(/p_properties \?\|/);
    expect(migration).not.toMatch(/source['"]?\s*,\s*medium|campaign|user_id|install_id|reflection_text|gratitude_note|raw_error/i);
  });

  it('validates replacement constraints before swapping and never leaves old constraints absent', () => {
    const migration = telemetryMigration();
    expect(migration).toMatch(/add constraint growth_analytics_events_event_name_v8_check[\s\S]*not valid;/);
    expect(migration).toMatch(/validate constraint growth_analytics_events_event_name_v8_check;/);
    expect(migration).toMatch(/add constraint growth_analytics_properties_v8_check[\s\S]*not valid;/);
    expect(migration).toMatch(/validate constraint growth_analytics_properties_v8_check;/);
    expect(migration).toMatch(/drop constraint growth_analytics_events_event_name_check;/);
    expect(migration).toMatch(/rename constraint growth_analytics_events_event_name_v8_check to growth_analytics_events_event_name_check;/);
    expect(migration).toMatch(/drop constraint growth_analytics_properties_check;/);
    expect(migration).toMatch(/rename constraint growth_analytics_properties_v8_check to growth_analytics_properties_check;/);
    expect(migration).not.toMatch(/drop constraint if exists growth_analytics_(?:events_event_name|properties)_check/);
  });

  it('narrows v8 execution to service_role without changing table ACLs or RLS', () => {
    const migration = telemetryMigration();
    expect(migration).toMatch(/revoke execute on function faith_harbor\.growth_event_properties_are_safe_v8\(text, jsonb\)\s+from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant execute on function faith_harbor\.growth_event_properties_are_safe_v8\(text, jsonb\)\s+to service_role;/i);
    expect(migration).not.toMatch(/(?:grant|revoke)[^;]*\bon\s+(?:table|schema)\b/i);
    expect(migration).not.toMatch(/enable row level security|disable row level security|create policy|alter policy|drop policy|alter role|security definer/i);
  });

  it('contains no destructive table, column, or schema operation', () => {
    const migration = telemetryMigration();
    expect(migration).not.toMatch(/drop\s+(?:table|column|schema)|truncate|delete\s+from/i);
    const drops = migration.match(/drop constraint[^;]+;/gi) ?? [];
    expect(drops).toEqual([
      'drop constraint growth_analytics_events_event_name_check;',
      'drop constraint growth_analytics_properties_check;',
    ]);
  });
});
