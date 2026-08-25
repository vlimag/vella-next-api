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

    expect(migration).not.toContain('create index');
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
    expect(summaryFunction).toContain("event.event_name = 'vella_profile_initialized'");
    expect(summaryFunction).toMatch(
      /event\.event_name = 'vella_profile_initialized'[\s\S]{0,240}event\.actor_type = 'authenticated'/,
    );
    expect(summaryFunction).toContain("'vella_profile_initialized'");
    expect(summaryFunction).toMatch(/event\.platform in \('ios', 'android'\)/);
    expect(summaryFunction).toContain('anchor.platform');
    expect(summaryFunction).toContain('anchor.cohort_day');
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

  it('keeps the ingestion index in a standalone bounded transactional migration', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const indexMigrationNames = fs.readdirSync(migrationsPath)
      .filter((name) => name.endsWith('_ordered_growth_funnel_index.sql'));
    expect(indexMigrationNames).toHaveLength(1);
    if (indexMigrationNames.length !== 1) return;

    const indexMigration = fs.readFileSync(
      path.join(migrationsPath, indexMigrationNames[0]),
      'utf8',
    );
    expect(indexMigration).toMatch(/set local lock_timeout = '2s';/i);
    expect(indexMigration).toMatch(/set local statement_timeout = '30s';/i);
    expect(indexMigration).toMatch(
      /create index idx_growth_analytics_installation_occurred_event\s+on faith_harbor\.growth_analytics_events \(installation_id, occurred_at, event_name\);/i,
    );
    expect(indexMigration).not.toMatch(/concurrently/i);
    expect(indexMigration).not.toMatch(/if not exists/i);
    expect(indexMigration).not.toMatch(/\b(?:alter|drop|create\s+(?:or\s+replace\s+)?function|insert|update|delete)\b/i);
  });

  it('documents truthful cohort memberships and observation-only period economics', () => {
    const dashboard = fs.readFileSync(
      path.resolve(process.cwd(), 'components/operator/GrowthDashboard.tsx'),
      'utf8',
    );
    const docs = fs.readFileSync(
      path.resolve(process.cwd(), 'docs/GROWTH_ANALYTICS.md'),
      'utf8',
    );

    for (const source of [dashboard, docs]) {
      expect(source).toContain('Vella profiles initialized');
      expect(source).toContain('Install-variant cohort memberships');
      expect(source).toContain('Period spend per authoritative paid transition');
      expect(source).toContain('observation only');
      expect(source).toContain('Paid campaigns remain paused');
    }
    expect(docs).toContain('indisvalid');
    expect(docs).toContain('indisready');
    expect(docs).toContain('Supabase MCP `apply_migration`');
    expect(docs).toContain('summary migration first');
    expect(docs).toContain('index migration second');
    expect(dashboard).not.toContain('Blended authoritative CAC');
    expect(docs).not.toContain('blended authoritative CAC');
  });
});
