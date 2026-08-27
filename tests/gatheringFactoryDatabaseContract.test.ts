import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FACTORY_TABLES = [
  'gathering_releases',
  'gathering_generation_runs',
  'gathering_generation_incidents',
  'gathering_automation_heartbeats',
  'gathering_operational_events',
  'gathering_content_metrics_daily',
] as const;

function migration(name: string) {
  return fs.readFileSync(
    path.resolve(process.cwd(), '../supabase/migrations', name),
    'utf8',
  );
}

function executableSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*$/gm, '');
}

function expectServerOnlyTable(sql: string, table: (typeof FACTORY_TABLES)[number]) {
  expect(sql).toMatch(new RegExp(`create table if not exists faith_harbor\\.${table}\\s*\\(`, 'i'));
  expect(sql).toMatch(new RegExp(`alter table faith_harbor\\.${table} enable row level security`, 'i'));
  expect(sql).toMatch(new RegExp(`revoke all on table faith_harbor\\.${table} from public, anon, authenticated`, 'i'));
  expect(sql).toMatch(new RegExp(`grant all on table faith_harbor\\.${table} to service_role`, 'i'));
}

describe('gathering content factory database contract', () => {
  it('defines bounded, privacy-safe release and operational records', () => {
    const sql = executableSql(migration('20260827210000_gathering_content_factory.sql'));

    expect(sql).toContain('create table if not exists faith_harbor.gathering_releases');
    expect(sql).toContain("check (slot_type in ('monday', 'thursday'))");
    expect(sql).toContain('unique (release_week, slot_type)');
    expect(sql).toContain("source_kind = 'evergreen' and release_week is null");
    expect(sql).toContain('create table if not exists faith_harbor.gathering_operational_events');
    expect(sql).not.toMatch(/user_id|email|receipt|purchase_token|private_prayer/i);
    expect(sql).toMatch(/add column if not exists release_id uuid[\s\S]*references faith_harbor\.gathering_releases\(id\)/i);

    for (const table of FACTORY_TABLES) {
      expectServerOnlyTable(sql, table);
    }
  });

  it('bounds each factory table to its allowed lifecycle and aggregate dimensions', () => {
    const sql = executableSql(migration('20260827210000_gathering_content_factory.sql'));

    expect(sql).toMatch(/target_week date not null check \(extract\(isodow from target_week\) = 1\)/i);
    expect(sql).toMatch(/attempt smallint not null check \(attempt between 1 and 2\)/i);
    expect(sql).toMatch(/lifecycle_state text not null check \(lifecycle_state in \('started', 'validated', 'published', 'failed'\)\)/i);
    expect(sql).toMatch(/input_tokens integer not null default 0 check \(input_tokens between 0 and 2000000\)/i);
    expect(sql).toMatch(/cost_microunits bigint not null default 0 check \(cost_microunits between 0 and 1000000000\)/i);

    expect(sql).toMatch(/catalog_code text not null unique[\s\S]*\^g-\[0-9\]\{4\}w\[0-9\]\{2\}-\(mon\|thu\)/i);
    expect(sql).toMatch(/status text not null check \(status in \('draft', 'published', 'retired'\)\)/i);
    expect(sql).toMatch(/content_hash text not null check \(content_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/i);

    expect(sql).toMatch(/incident_type text not null check \(incident_type in \('generation_failed', 'inventory_low', 'heartbeat_stale', 'publish_failed'\)\)/i);
    expect(sql).toMatch(/alert_attempts smallint not null default 0 check \(alert_attempts between 0 and 99\)/i);
    expect(sql).toMatch(/heartbeat_source text not null check \(heartbeat_source in \('vercel_cron', 'supabase_watchdog'\)\)/i);
    expect(sql).toMatch(/inventory_depth smallint not null check \(inventory_depth between 0 and 52\)/i);

    expect(sql).toMatch(/event_state text not null check \(event_state in \('started', 'succeeded', 'failed', 'skipped'\)\)/i);
    expect(sql).toMatch(/duration_bucket text check \(duration_bucket is null or duration_bucket in \('under_1s', '1_4s', '5_29s', '30_119s', '120s_plus'\)\)/i);
    expect(sql).toMatch(/locale text not null check \(locale in \('en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'\)\)/i);
    expect(sql).toMatch(/check \(completions <= starts and starts <= views\)/i);
  });

  it('indexes every nullable factory foreign key and retains operational events for thirty days', () => {
    const sql = executableSql(migration('20260827210000_gathering_content_factory.sql'));

    for (const [name, table, column] of [
      ['idx_gathering_templates_release_id', 'gathering_templates', 'release_id'],
      ['idx_gathering_releases_generation_run_id', 'gathering_releases', 'generation_run_id'],
      ['idx_gathering_generation_incidents_run_id', 'gathering_generation_incidents', 'generation_run_id'],
      ['idx_gathering_generation_incidents_release_id', 'gathering_generation_incidents', 'release_id'],
      ['idx_gathering_automation_heartbeats_last_successful_release_id', 'gathering_automation_heartbeats', 'last_successful_release_id'],
      ['idx_gathering_operational_events_run_id', 'gathering_operational_events', 'generation_run_id'],
      ['idx_gathering_operational_events_release_id', 'gathering_operational_events', 'release_id'],
    ]) {
      expect(sql).toMatch(new RegExp(
        `create index if not exists ${name}\\s+on faith_harbor\\.${table}\\(${column}\\)\\s+where ${column} is not null`,
        'i',
      ));
    }
    expect(sql).toMatch(/create index if not exists idx_gathering_content_metrics_daily_release[\s\S]*on faith_harbor\.gathering_content_metrics_daily\(release_id, metric_date desc\)/i);
    expect(sql).toMatch(/delete_after timestamptz not null default \(now\(\) \+ interval '30 days'\)/i);
    expect(sql).toMatch(/create or replace function faith_harbor\.purge_expired_gathering_operational_events\(/i);
    expect(sql).toMatch(/where expired\.delete_after <= clock_timestamp\(\)/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.purge_expired_gathering_operational_events\(integer\)[\s\S]*to service_role/i);
  });

  it('seeds exact shareable Gathering milestones for unique completions', () => {
    const sql = executableSql(migration('20260827210000_gathering_content_factory.sql'));

    for (const [code, threshold, tier, assetKey] of [
      ['gathering_first_light', 1, 'first_light', 'flame.spark'],
      ['gathering_monthly_rhythm', 8, 'monthly_rhythm', 'flame.steady'],
      ['gathering_season_keeper', 24, 'season_keeper', 'flame.rooted'],
      ['gathering_long_companion', 52, 'long_companion', 'flame.pilgrim'],
    ]) {
      expect(sql).toMatch(new RegExp(
        `\\('${code}'\\s*,[\\s\\S]{0,500}?'unique_gatherings'\\s*,\\s*${threshold}\\s*,[\\s\\S]{0,500}?'gathering'\\s*,\\s*'${tier}'\\s*,\\s*null\\s*,\\s*'${assetKey}'\\s*,\\s*\\d+\\s*,\\s*true\\s*,\\s*true\\s*\\)`,
        'i',
      ));
    }
  });

  it('parses canonical Scripture references into book, chapter, and verse captures', () => {
    const sql = executableSql(migration('20260827210400_fix_gathering_scripture_resolution.sql'));

    expect(sql).toMatch(/v_parts := regexp_match\(trim\(p_reference\), '\^\(\.\*\) \(\[0-9\]\{1,3\}\):\(\[0-9\]\{1,3\}\)/i);
    expect(sql).toContain('v_book := v_parts[1]');
    expect(sql).toContain('v_chapter := v_parts[2]::integer');
    expect(sql).toContain('v_verse := v_parts[3]::integer');
    expect(sql).not.toContain('regexp_replace');
    expect(sql).toMatch(/revoke all on function faith_harbor\.gathering_factory_resolve_scripture\(text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.gathering_factory_resolve_scripture\(text\) to service_role/i);
  });
});
