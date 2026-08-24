import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ordered growth funnel migration', () => {
  it('defines occurred-at reporting with service-only privacy gates and legacy skew keys', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const migrationName = fs.readdirSync(migrationsPath)
      .find((name) => name.endsWith('_ordered_growth_funnel_summary.sql'));
    expect(migrationName).toBeDefined();
    if (!migrationName) return;

    const migration = fs.readFileSync(path.join(migrationsPath, migrationName), 'utf8');
    const summaryFunction = migration.match(
      /create or replace function faith_harbor\.growth_analytics_summary\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';

    expect(migration).toMatch(
      /create index if not exists idx_growth_analytics_installation_occurred_event\s+on faith_harbor\.growth_analytics_events \(installation_id, occurred_at, event_name\);/,
    );
    expect(summaryFunction).toMatch(
      /growth_analytics_summary\(\s*p_from date,\s*p_to date,\s*p_cohort_days integer default 14\s*\)/,
    );
    expect(summaryFunction).toContain('security invoker');
    expect(summaryFunction).toMatch(/set search_path\s*=\s*''/);
    expect(summaryFunction).not.toContain('security definer');
    expect(summaryFunction).toContain("actor_type = 'authenticated'");
    expect(summaryFunction).toContain("properties ->> 'destination' = 'app'");
    expect(summaryFunction).toContain("properties ->> 'auth_state' = 'authenticated'");
    expect(summaryFunction).toContain("properties ->> 'subscription_state' = 'active'");
    expect(summaryFunction).toContain("environment = 'production'");
    expect(summaryFunction).toContain(
      'distinct on (first_open.installation_id, first_open.funnel_variant)',
    );
    expect(summaryFunction).toMatch(/having count\(distinct [^)]+subscription_id\) >= 20/);
    expect(summaryFunction).not.toMatch(/\b(?:join|from)\s+(?:auth\.|faith_harbor\.(?:profiles|users))/i);
    expect(summaryFunction).not.toMatch(/jsonb_build_object\([^)]*'(?:user_id|installation_id|subscription_id)'/i);

    for (const key of [
      'ordered_funnel',
      'diagnostic_totals',
      'release_cohorts',
      'authoritative_transitions',
      'privacy',
    ]) {
      expect(summaryFunction).toContain(`'${key}'`);
    }
    expect(migration).toMatch(
      /alter function faith_harbor\.growth_analytics_summary\(date, date, integer\)\s+rename to growth_analytics_diagnostic_summary;/,
    );
    expect(summaryFunction).toContain('v_diagnostics := faith_harbor.growth_analytics_diagnostic_summary(');
    expect(summaryFunction).toContain('return v_diagnostics || jsonb_build_object(');

    expect(migration).toMatch(
      /revoke all on function faith_harbor\.growth_analytics_summary\(date, date, integer\)\s+from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /grant execute on function faith_harbor\.growth_analytics_summary\(date, date, integer\)\s+to service_role;/,
    );
  });
});
