import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260827210100_gathering_catalog_v2.sql',
);

function migration() {
  return fs.readFileSync(migrationPath, 'utf8');
}

function functionBody(sql: string, name: string) {
  const match = sql.match(new RegExp(
    `create or replace function faith_harbor\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  expect(match, `missing ${name}`).not.toBeNull();
  return match?.[0] ?? '';
}

describe('gathering catalog v2 database contract', () => {
  it('defines a timezone-aware catalog that keeps anonymous reads free of progress', () => {
    const sql = migration();
    const catalog = functionBody(sql, 'get_gathering_catalog_v2');

    expect(sql).toMatch(/create or replace function faith_harbor\.get_gathering_catalog_v2\(/i);
    expect(catalog).toContain("timezone(coalesce(v_timezone_name, 'UTC'), p_now)");
    expect(catalog).toContain("slot_type = 'monday'");
    expect(catalog).toContain("slot_type = 'thursday'");
    expect(catalog).toMatch(/from pg_catalog\.pg_timezone_names/i);
    expect(catalog).toMatch(/account\.is_anonymous is false/i);
    expect(catalog).toMatch(/v_permanent_account_id is not null/i);
    expect(catalog).toMatch(/'schema_version', 2/i);
    expect(catalog).toMatch(/'featured'/i);
    expect(catalog).toMatch(/'history'/i);
    expect(catalog).toMatch(/'next_release'/i);
    expect(catalog).toMatch(/'fallback_used'/i);
  });

  it('makes progress server-authoritative, release-unique, idempotent, and safely rewarded', () => {
    const sql = migration();
    const progress = functionBody(sql, 'save_gathering_progress_v2');

    expect(progress).toMatch(/p_state is null[\s\S]*p_state not in \('in_progress', 'completed'\)/i);
    expect(progress).toMatch(/p_current_step < 0[\s\S]*p_current_step > 8/i);
    expect(progress).toMatch(/p_state = 'completed'[\s\S]*p_current_step <> 8/i);
    expect(progress).toMatch(/pg_catalog\.clock_timestamp\(\)/i);
    expect(progress).toMatch(/pg_catalog\.pg_advisory_xact_lock/i);
    expect(progress).toMatch(/hashtextextended\(\s*p_owner_user_id::text,\s*1\s*\)/i);
    expect(progress.match(/pg_catalog\.pg_advisory_xact_lock/gi)).toHaveLength(2);
    const accountLock = progress.indexOf('p_owner_user_id::text,\n      1');
    const progressInsert = progress.indexOf('insert into faith_harbor.user_gathering_progress');
    const completionWrite = progress.indexOf('completion_idempotency_key = case');
    expect(accountLock).toBeGreaterThanOrEqual(0);
    expect(progressInsert).toBeGreaterThanOrEqual(0);
    expect(completionWrite).toBeGreaterThanOrEqual(0);
    expect(accountLock).toBeLessThan(progressInsert);
    expect(accountLock).toBeLessThan(completionWrite);
    expect(progress).toMatch(/completion_idempotency_key = p_idempotency_key[\s\S]*gathering_template_id <> p_template_id[\s\S]*'idempotency_conflict'/i);
    expect(progress).toMatch(/count\(distinct completed_template\.release_id\)/i);
    expect(progress).toMatch(/'gathering_first_light'/i);
    expect(progress).toMatch(/'gathering_monthly_rhythm'/i);
    expect(progress).toMatch(/'gathering_season_keeper'/i);
    expect(progress).toMatch(/'gathering_long_companion'/i);
    expect(progress).toMatch(/on conflict do nothing[\s\S]*returning milestone\.milestone_code/i);
    expect(progress).toMatch(/'new_milestone_codes'/i);
    expect(progress).not.toMatch(/email|receipt|private_prayer|journal|reflection_text/i);
  });

  it('keeps v1 progress compatible while serializing its completion key with v2', () => {
    const sql = migration();
    const progress = functionBody(sql, 'save_gathering_progress_v1');

    expect(progress).toMatch(/p_owner_user_id uuid,[\s\S]*p_occurred_at timestamptz/i);
    expect(progress).toMatch(/security invoker\s+set search_path = ''/i);
    expect(progress).toMatch(/p_complete and p_idempotency_key is null/i);
    expect(progress).toMatch(/'already_completed'[\s\S]*'practice_credit', 'guided_prayer'[\s\S]*'telemetry_events'/i);
    expect(progress).toMatch(/case\s+when p_complete then 'completed'[\s\S]*when p_current_step > prior_step then 'updated'[\s\S]*else 'already_updated'/i);
    expect(progress).toMatch(/pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(\s*p_owner_user_id::text,\s*1\s*\)\)/i);
    const accountLock = progress.indexOf('p_owner_user_id::text,\n      1');
    const progressInsert = progress.indexOf('insert into faith_harbor.user_gathering_progress');
    const completionWrite = progress.indexOf('completion_idempotency_key = case');
    expect(accountLock).toBeGreaterThanOrEqual(0);
    expect(progressInsert).toBeGreaterThanOrEqual(0);
    expect(completionWrite).toBeGreaterThanOrEqual(0);
    expect(accountLock).toBeLessThan(progressInsert);
    expect(accountLock).toBeLessThan(completionWrite);
    expect(progress).toMatch(/completion_idempotency_key = p_idempotency_key[\s\S]*gathering_template_id <> selected_template\.id[\s\S]*'idempotency_conflict'/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.save_gathering_progress_v1\([\s\S]*from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.save_gathering_progress_v1\([\s\S]*to service_role;/i);
  });

  it('keeps operational and aggregate writes finite, identity-free, and service-only', () => {
    const sql = migration();
    const operational = functionBody(sql, 'record_gathering_operational_event_v1');
    const aggregate = functionBody(sql, 'aggregate_gathering_metrics_v1');

    expect(operational).toMatch(/p_event_name not in \([\s\S]*'inventory_checked'[\s\S]*'watchdog_checked'/i);
    expect(operational).toMatch(/p_event_name is null[\s\S]*p_event_state is null[\s\S]*p_slot_type is null[\s\S]*p_locale is null/i);
    expect(operational).toMatch(/p_locale is not null and p_locale not in \(/i);
    expect(operational).toMatch(/p_safe_error_code is not null and p_safe_error_code not in \(/i);
    expect(aggregate).toMatch(/p_metric_name is null[\s\S]*p_metric_name not in \('view', 'start', 'completion', 'resume', 'step_dropout'\)/i);
    expect(aggregate).toMatch(/on conflict \(metric_date, release_id, locale\) do update/i);
    expect(aggregate).toMatch(/case when p_metric_name = 'view' then p_increment else 0 end/i);
    expect(aggregate).toMatch(/case when p_metric_name = 'start' then p_increment else 0 end/i);
    expect(aggregate).toMatch(/case when p_metric_name = 'completion' then p_increment else 0 end/i);
    expect(aggregate).not.toMatch(/p_metric_name in \('view', 'start', 'completion', 'resume', 'step_dropout'\)/i);
    expect(`${operational}\n${aggregate}`).not.toMatch(/user_id|account_id|email|receipt|private_prayer|journal/i);
    expect(sql).toMatch(/alter table faith_harbor\.gathering_content_metrics_daily\s+drop constraint if exists gathering_content_metrics_daily_check;/i);
    expect(sql).toMatch(/add constraint gathering_content_metrics_daily_independent_counters_check/i);
  });

  it('hardens every v2 RPC with an empty search path and service-role-only execution', () => {
    const sql = migration();
    for (const [name, signature] of [
      ['get_gathering_catalog_v2', 'uuid, text, text, timestamptz'],
      ['save_gathering_progress_v2', 'uuid, uuid, integer, text, uuid, text'],
      ['record_gathering_operational_event_v1', 'text, text, text, text, text, text'],
      ['aggregate_gathering_metrics_v1', 'date, uuid, text, text, text, integer'],
    ]) {
      const body = functionBody(sql, name);
      expect(body).toMatch(/security definer\s+set search_path = ''/i);
      expect(sql).toMatch(new RegExp(
        `revoke all on function faith_harbor\\.${name}\\([\\s\\S]*?from public, anon, authenticated;`,
        'i',
      ));
      expect(sql).toMatch(new RegExp(
        `grant execute on function faith_harbor\\.${name}\\([\\s\\S]*?to service_role;`,
        'i',
      ));
      expect(sql).toContain(signature);
    }
  });
});
