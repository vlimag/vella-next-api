import { execFileSync } from 'node:child_process';
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

    expect(eventNames).toEqual(expect.arrayContaining([...GATHERING_EVENTS]));
    expect(new Set(eventNames).size).toBe(eventNames.length);
    expect(eventNames.filter((eventName) => eventName.startsWith('gathering_')))
      .toEqual(expect.arrayContaining([...GATHERING_EVENTS]));
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
    expect(branch(sql, 'gathering_session_abandoned')).toMatch(
      /case\s+when\s+jsonb_typeof\(p_properties -> 'step_index'\) = 'number'\s+then[\s\S]*?else\s+false\s+end/i,
    );
  });

  it('rejects non-numeric step indexes without a cast exception at the database boundary', () => {
    const script = String.raw`set -euo pipefail
for prerequisite in initdb pg_ctl psql; do
  command -v "$prerequisite" >/dev/null
done

PG_ROOT=$(mktemp -d)
PG_DATA="$PG_ROOT/data"
PG_PORT=55480
case "$PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) exit 1 ;;
esac
cleanup() {
  pg_ctl -D "$PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$PG_ROOT"
}
trap cleanup EXIT
initdb -D "$PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -o "-F -p $PG_PORT -k $PG_ROOT" -w start >/dev/null
psql_exec() {
  psql -X -v ON_ERROR_STOP=1 -h "$PG_ROOT" -p "$PG_PORT" postgres "$@"
}
psql_exec >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema faith_harbor;
create function faith_harbor.growth_event_properties_are_safe_v7(text, jsonb)
returns boolean language sql immutable set search_path = '' as $$ select true $$;
create table faith_harbor.growth_analytics_events (
  id integer primary key,
  event_name text not null,
  properties jsonb not null
);
alter table faith_harbor.growth_analytics_events
  add constraint growth_analytics_events_event_name_check
  check (event_name in ('legacy_event')) not valid;
alter table faith_harbor.growth_analytics_events
  add constraint growth_analytics_properties_check
  check (faith_harbor.growth_event_properties_are_safe_v7(event_name, properties)) not valid;
SQL
psql_exec --single-transaction -f "$V8_PATH" >/dev/null
psql_exec --single-transaction -f "$MILESTONE_V9_PATH" >/dev/null
psql_exec --single-transaction -f "$MIGRATION_PATH" >/dev/null

RESULT=$(psql_exec -At <<'SQL'
select faith_harbor.growth_event_properties_are_safe_v9(
  'gathering_session_abandoned',
  '{"catalog_code":"g-2026w35-mon","step_index":4,"abandonment_reason":"backgrounded","elapsed_bucket":"2_4m"}'::jsonb
);
select faith_harbor.growth_event_properties_are_safe_v9(
  'gathering_session_abandoned',
  '{"catalog_code":"g-2026w35-mon","step_index":9,"abandonment_reason":"backgrounded","elapsed_bucket":"2_4m"}'::jsonb
);
select faith_harbor.growth_event_properties_are_safe_v9(
  'gathering_session_abandoned',
  '{"catalog_code":"g-2026w35-mon","step_index":"not-a-number","abandonment_reason":"backgrounded","elapsed_bucket":"2_4m"}'::jsonb
);
SQL
)
test "$RESULT" = $'t\nf\nf'
psql_exec >/dev/null <<'SQL'
do $$
begin
  begin
    insert into faith_harbor.growth_analytics_events (id, event_name, properties)
    values (1, 'gathering_session_abandoned',
      '{"catalog_code":"g-2026w35-mon","step_index":"not-a-number","abandonment_reason":"backgrounded","elapsed_bucket":"2_4m"}'::jsonb);
    raise exception 'non-numeric step index accepted';
  exception
    when check_violation then null;
  end;
end
$$;
SQL`;

    expect(() => execFileSync('bash', ['-c', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MIGRATION_PATH: migrationPath,
        V8_PATH: path.resolve(process.cwd(), '../supabase/migrations/20260826042116_vella_rhythms_telemetry.sql'),
        MILESTONE_V9_PATH: path.resolve(process.cwd(), '../supabase/migrations/20260826170015_extend_rhythm_milestone_telemetry.sql'),
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })).not.toThrow();
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
