import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260827210200_gathering_telemetry_v2.sql',
);

const GATHERING_EVENTS = [
  'gathering_catalog_loaded',
  'gathering_card_viewed',
  'gathering_card_selected',
  'gathering_next_release_viewed',
  'gathering_session_abandoned',
  'gathering_replayed',
  'gathering_fallback_used',
] as const;

const GATHERING_BADGES = [
  'gathering_first_light',
  'gathering_monthly_rhythm',
  'gathering_season_keeper',
  'gathering_long_companion',
] as const;

const contracts = {
  gathering_catalog_loaded: [
    'source_surface', 'result', 'cache_state', 'item_count_bucket', 'next_slot_type',
  ],
  gathering_card_viewed: ['catalog_code', 'slot_type', 'source_surface'],
  gathering_card_selected: ['catalog_code', 'slot_type', 'source_surface'],
  gathering_next_release_viewed: ['source_surface', 'next_slot_type', 'countdown_bucket'],
  gathering_session_abandoned: [
    'catalog_code', 'step_index', 'abandonment_reason', 'elapsed_bucket',
  ],
  gathering_replayed: ['catalog_code', 'source_surface'],
  gathering_fallback_used: ['source_surface', 'cache_state', 'error_code'],
} as const;

function migration() {
  if (!fs.existsSync(migrationPath)) return '';
  return fs.readFileSync(migrationPath, 'utf8');
}

function branch(sql: string, eventName: string) {
  return sql.match(new RegExp(
    `when p_event_name = '${eventName}' then([\\s\\S]*?)(?=\\n    when p_event_name =|\\n    else )`,
  ))?.[1] ?? '';
}

describe('Gathering telemetry v2 database contract', () => {
  it('allowlists exactly the seven new event names', () => {
    const sql = migration();
    const eventList = sql.match(
      /growth_analytics_events_event_name_v9_check check \(event_name in \(([\s\S]*?)\n  \)\) not valid;/,
    )?.[1] ?? '';
    const eventNames = [...eventList.matchAll(/'([^']+)'/g)].map((match) => match[1]);

    expect(eventNames).toEqual(expect.arrayContaining(GATHERING_EVENTS));
    expect(new Set(eventNames).size).toBe(eventNames.length);
    expect(eventNames.filter((eventName) => eventName.startsWith('gathering_')))
      .toEqual(expect.arrayContaining(GATHERING_EVENTS));
    expect(eventNames.filter((eventName) => eventName.startsWith('gathering_')))
      .toHaveLength(12);
  });

  it('uses exact scalar property keys and rejects private or prose-shaped fields by construction', () => {
    const sql = migration();
    for (const [eventName, keys] of Object.entries(contracts)) {
      const eventBranch = branch(sql, eventName);
      expect(eventBranch).toContain('p_properties = jsonb_build_object');
      for (const key of keys) {
        expect(eventBranch).toContain(`'${key}'`);
      }
      expect(eventBranch).toMatch(/jsonb_build_object\(/);
      expect(eventBranch).not.toMatch(/user_id|account_id|install_id|raw_title|title|body|content|raw_error|email/i);
    }
    expect(sql).not.toMatch(/p_properties \?\||jsonb_object_keys\(p_properties\)/i);
  });

  it('enforces finite Gathering dimensions, generated catalog identity, and eight-step indexes', () => {
    const sql = migration();
    expect(sql).toMatch(/\^g-\[0-9\]\{4\}w\[0-9\]\{2\}-\(mon\|thu\)\$/);
    expect(sql).toMatch(/jsonb_typeof\(p_properties -> 'step_index'\) = 'number'/);
    expect(sql).toMatch(/\(p_properties ->> 'step_index'\)::numeric = trunc\(\(p_properties ->> 'step_index'\)::numeric\)/);
    expect(sql).toMatch(/\(p_properties ->> 'step_index'\)::numeric between 1 and 8/);
    expect(sql).toMatch(/source_surface' in \([\s\S]*'rhythms_hub'[\s\S]*'gathering'[\s\S]*'profile'/);
    expect(sql).toMatch(/slot_type' in \('monday', 'thursday'\)/);
    expect(sql).toMatch(/next_slot_type' in \('monday', 'thursday'\)/);
    expect(sql).toMatch(/cache_state' in \('miss', 'fresh', 'stale', 'fallback'\)/);
    expect(sql).toMatch(/abandonment_reason' in \('user_exit', 'backgrounded', 'superseded', 'error'\)/);
    expect(sql).toMatch(/elapsed_bucket' in \('under_30s', '30_119s', '2_4m', '5_14m', '15m_plus'\)/);
    expect(sql).toMatch(/countdown_bucket' in \('under_1h', '1_24h', '1_3d', '4_7d', '8d_plus'\)/);
    expect(sql).toMatch(/item_count_bucket' in \('0', '1', '2_5', '6_11', '12_plus'\)/);
    expect(sql).toMatch(/error_code' in \([\s\S]*'network_unavailable'[\s\S]*'invalid_response'[\s\S]*'server_unavailable'[\s\S]*'unknown'[\s\S]*\)/);
  });

  it('keeps the four Gathering milestone codes finite and preserves the previous validator', () => {
    const sql = migration();
    expect(sql).toContain('growth_event_properties_are_safe_v8(p_event_name, p_properties)');
    for (const code of GATHERING_BADGES) expect(sql).toContain(`'${code}'`);
    expect(sql).toMatch(/when p_event_name = 'milestone_earned' then[\s\S]*gathering_first_light[\s\S]*gathering_long_companion/);
    expect(sql).not.toMatch(/milestone_earned[\s\S]*\?\|/i);
  });

  it('uses the NOT VALID compatibility sequence without rewriting historical rows', () => {
    const sql = migration();
    expect(sql).toMatch(/add constraint growth_analytics_events_event_name_v9_check[\s\S]*not valid;/i);
    expect(sql).toMatch(/validate constraint growth_analytics_events_event_name_v9_check;/i);
    expect(sql).toMatch(/add constraint growth_analytics_properties_v9_check[\s\S]*not valid;/i);
    expect(sql).not.toMatch(/validate constraint growth_analytics_properties_v9_check;/i);
    expect(sql).toMatch(/drop constraint growth_analytics_events_event_name_check;/i);
    expect(sql).toMatch(/rename constraint growth_analytics_events_event_name_v9_check to growth_analytics_events_event_name_check;/i);
    expect(sql).toMatch(/drop constraint growth_analytics_properties_check;/i);
    expect(sql).toMatch(/rename constraint growth_analytics_properties_v9_check to growth_analytics_properties_check;/i);
    expect(sql).not.toMatch(/\b(update|delete|truncate)\b|insert\s+into\s+faith_harbor\.growth_analytics_events/i);
  });

  it('limits validator execution to service_role and does not alter table security', () => {
    const sql = migration();
    expect(sql).toMatch(/revoke execute on function faith_harbor\.growth_event_properties_are_safe_v9\(text, jsonb\)[\s\S]*from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.growth_event_properties_are_safe_v9\(text, jsonb\)[\s\S]*to service_role;/i);
    expect(sql).not.toMatch(/(?:grant|revoke)[^;]*\bon\s+(?:table|schema)\b/i);
    expect(sql).not.toMatch(/security definer|enable row level security|disable row level security|create policy|alter policy|drop policy/i);
  });
});
